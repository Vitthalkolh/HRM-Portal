using HRM.Server.Data;
using HRM.Server.DTOs;
using HRM.Server.Entities;
using HRM.Server.Infrastructure;
using HRM.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRM.Server.Controllers;

/// <summary>Reimbursement / expense claims. Employees manage their own; administrators review all.</summary>
[ApiController]
[Authorize]
[Route("api/reimbursements")]
public sealed class ReimbursementsController(
    HrmDbContext db,
    IFileStorage files,
    IAuditService audit,
    INotificationService notifications) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.ExpenseClaims.AsNoTracking().AsQueryable();

        // An employee only ever sees their own claims, regardless of the query string.
        if (!User.IsAdmin())
        {
            var self = await SelfEmployeeIdAsync(ct);
            query = query.Where(x => x.EmployeeId == self);
        }

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ReviewStatus>(status, true, out var parsed))
            query = query.Where(x => x.Status == parsed);

        var total = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(Projection)
            .ToListAsync(ct);

        return Ok(new ApiResponse<PagedResult<ExpenseClaimDto>>(true, "Reimbursement claims.",
            new PagedResult<ExpenseClaimDto>(items, page, pageSize, total)));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        var claim = await db.ExpenseClaims.AsNoTracking().Where(x => x.Id == id).Select(Projection).FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("That claim could not be found.");

        await EnsureCanAccessAsync(claim.EmployeeId, ct);
        return Ok(new ApiResponse<ExpenseClaimDto>(true, "Reimbursement claim.", claim));
    }

    [HttpPost]
    public async Task<IActionResult> Create(ExpenseClaimRequest request, CancellationToken ct)
    {
        if (request.ExpenseDate > DateOnly.FromDateTime(DateTime.UtcNow))
            throw AppException.BadRequest("An expense date cannot be in the future.");

        var employeeId = await SelfEmployeeIdAsync(ct);

        var claim = new ExpenseClaim
        {
            EmployeeId = employeeId,
            ExpenseType = request.ExpenseType.Trim(),
            ExpenseDate = request.ExpenseDate,
            Amount = request.Amount,
            Description = request.Description.Trim(),
            ReferenceUrl = request.ReferenceUrl?.Trim(),
            Status = ReviewStatus.Pending,
        };

        db.ExpenseClaims.Add(claim);
        await db.SaveChangesAsync(ct);
        await audit.RecordAsync("Reimbursement", "Create", claim.Id.ToString(), $"{claim.ExpenseType} {claim.Amount:0.00}", ct: ct);

        foreach (var adminId in await AdminUserIdsAsync(ct))
        {
            await notifications.NotifyAsync(adminId, "Reimbursement claim submitted",
                $"A {claim.ExpenseType} claim of {claim.Amount:0.00} is awaiting review.",
                "Reimbursement", "/admin/reimbursements", ct);
        }

        return Ok(new ApiResponse<ExpenseClaimDto>(true, "Claim submitted.", await GetDtoAsync(claim.Id, ct)));
    }

    [HttpPost("{id:int}/attachment")]
    [RequestSizeLimit(8 * 1024 * 1024)]
    public async Task<IActionResult> UploadAttachment(int id, IFormFile file, CancellationToken ct)
    {
        var claim = await db.ExpenseClaims.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("That claim could not be found.");

        await EnsureCanAccessAsync(claim.EmployeeId, ct);

        if (claim.Status != ReviewStatus.Pending)
            throw AppException.BadRequest("A reviewed claim cannot be changed.");

        var stored = await files.SaveAsync(file, FileCategory.ReimbursementAttachment, claim.EmployeeId, User.UserId(), ct);

        var previousId = claim.AttachmentFileId;
        claim.AttachmentFileId = stored.Id;
        claim.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        if (previousId is not null)
        {
            var previous = await db.StoredFiles.FirstOrDefaultAsync(x => x.Id == previousId, ct);
            if (previous is not null)
            {
                files.Delete(previous.StoragePath);
                db.StoredFiles.Remove(previous);
                await db.SaveChangesAsync(ct);
            }
        }

        return Ok(new ApiResponse<object>(true, "Attachment uploaded.", new { attachmentFileId = stored.Id }));
    }

    [HttpGet("{id:int}/attachment")]
    public async Task<IActionResult> DownloadAttachment(int id, CancellationToken ct)
    {
        var claim = await db.ExpenseClaims.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("That claim could not be found.");

        await EnsureCanAccessAsync(claim.EmployeeId, ct);

        if (claim.AttachmentFileId is null) throw AppException.NotFound("That claim has no attachment.");

        var file = await db.StoredFiles.AsNoTracking().FirstOrDefaultAsync(x => x.Id == claim.AttachmentFileId, ct)
            ?? throw AppException.NotFound("That attachment is no longer available.");

        var stream = await files.OpenReadAsync(file, ct);
        return File(stream, file.ContentType, file.OriginalFileName);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, ExpenseClaimRequest request, CancellationToken ct)
    {
        var claim = await db.ExpenseClaims.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("That claim could not be found.");

        await EnsureCanAccessAsync(claim.EmployeeId, ct);

        if (claim.Status != ReviewStatus.Pending)
            throw AppException.BadRequest("A reviewed claim cannot be changed.");

        claim.ExpenseType = request.ExpenseType.Trim();
        claim.ExpenseDate = request.ExpenseDate;
        claim.Amount = request.Amount;
        claim.Description = request.Description.Trim();
        claim.ReferenceUrl = request.ReferenceUrl?.Trim();
        claim.UpdatedAtUtc = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        await audit.RecordAsync("Reimbursement", "Update", id.ToString(), null, ct: ct);

        return Ok(new ApiResponse<ExpenseClaimDto>(true, "Claim updated.", await GetDtoAsync(id, ct)));
    }

    [HttpPost("{id:int}/review"), Authorize(Policy = "Admin")]
    public async Task<IActionResult> Review(int id, ReviewClaimRequest request, CancellationToken ct)
    {
        if (!Enum.TryParse<ReviewStatus>(request.Status, true, out var status) || status == ReviewStatus.Pending)
            throw AppException.BadRequest("Status must be Approved or Rejected.");

        var claim = await db.ExpenseClaims.Include(x => x.Employee).FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("That claim could not be found.");

        if (claim.Status != ReviewStatus.Pending)
            throw AppException.Conflict("That claim has already been reviewed.");

        claim.Status = status;
        claim.AdminNotes = request.AdminNotes?.Trim();
        claim.ReviewedByUserId = User.UserId();
        claim.ReviewedAtUtc = DateTime.UtcNow;
        claim.UpdatedAtUtc = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        await audit.RecordAsync("Reimbursement", status.ToString(), id.ToString(), request.AdminNotes, ct: ct);

        await notifications.NotifyAsync(claim.Employee.UserId, $"Reimbursement {status.ToString().ToLowerInvariant()}",
            $"Your {claim.ExpenseType} claim of {claim.Amount:0.00} was {status.ToString().ToLowerInvariant()}.",
            "Reimbursement", "/employee/reimbursements", ct);

        return Ok(new ApiResponse<ExpenseClaimDto>(true, $"Claim {status.ToString().ToLowerInvariant()}.", await GetDtoAsync(id, ct)));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var claim = await db.ExpenseClaims.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("That claim could not be found.");

        await EnsureCanAccessAsync(claim.EmployeeId, ct);

        if (claim.Status != ReviewStatus.Pending && !User.IsAdmin())
            throw AppException.BadRequest("A reviewed claim can no longer be withdrawn.");

        db.ExpenseClaims.Remove(claim);
        await db.SaveChangesAsync(ct);
        await audit.RecordAsync("Reimbursement", "Delete", id.ToString(), null, ct: ct);

        return Ok(new ApiResponse<object>(true, "Claim withdrawn."));
    }

    private async Task<ExpenseClaimDto> GetDtoAsync(int id, CancellationToken ct) =>
        await db.ExpenseClaims.AsNoTracking().Where(x => x.Id == id).Select(Projection).FirstAsync(ct);

    private async Task EnsureCanAccessAsync(int employeeId, CancellationToken ct)
    {
        if (User.IsAdmin()) return;
        if (await SelfEmployeeIdAsync(ct) != employeeId)
            throw AppException.Forbidden("You can only view your own reimbursement claims.");
    }

    private async Task<int> SelfEmployeeIdAsync(CancellationToken ct)
    {
        var userId = User.UserId();
        return await db.Employees.Where(x => x.UserId == userId).Select(x => (int?)x.Id).FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("No employee record is linked to your account.");
    }

    private async Task<List<int>> AdminUserIdsAsync(CancellationToken ct) =>
        await db.Users.Where(x => x.Role == RoleName.Admin && x.IsActive).Select(x => x.Id).ToListAsync(ct);

    private static readonly System.Linq.Expressions.Expression<Func<ExpenseClaim, ExpenseClaimDto>> Projection =
        x => new ExpenseClaimDto(
            x.Id, x.EmployeeId, x.Employee.FirstName + " " + x.Employee.LastName,
            x.ExpenseType, x.ExpenseDate, x.Amount, x.Description, x.ReferenceUrl,
            x.Status.ToString(), x.AttachmentFileId, x.AdminNotes, x.CreatedAtUtc);
}
