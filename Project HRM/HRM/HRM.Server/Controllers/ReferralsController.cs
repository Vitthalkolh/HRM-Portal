using HRM.Server.Data;
using HRM.Server.DTOs;
using HRM.Server.Entities;
using HRM.Server.Infrastructure;
using HRM.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRM.Server.Controllers;

/// <summary>
/// Candidate referrals. An employee sees their own submissions and their status, but never the
/// recruiter's internal notes.
/// </summary>
[ApiController]
[Authorize]
[Route("api/referrals")]
public sealed class ReferralsController(
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

        var isAdmin = User.IsAdmin();
        var query = db.Referrals.AsNoTracking().AsQueryable();

        if (!isAdmin)
        {
            var self = await SelfEmployeeIdAsync(ct);
            query = query.Where(x => x.EmployeeId == self);
        }

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ReferralStatus>(status, true, out var parsed))
            query = query.Where(x => x.Status == parsed);

        var total = await query.CountAsync(ct);

        var rows = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                x.Id, x.EmployeeId,
                ReferredBy = x.Employee.FirstName + " " + x.Employee.LastName,
                x.CandidateName, x.CandidateEmail, x.CandidatePhone, x.Position,
                x.LinkedInUrl, x.Notes, x.ResumeFileId, x.Status, x.InternalNotes, x.CreatedAtUtc,
            })
            .ToListAsync(ct);

        var items = rows.Select(x => new ReferralDto(
            x.Id, x.EmployeeId, x.ReferredBy, x.CandidateName, x.CandidateEmail, x.CandidatePhone,
            x.Position, x.LinkedInUrl, x.Notes, x.ResumeFileId, x.Status.ToString(),
            // Internal notes are stripped for everyone except administrators.
            isAdmin ? x.InternalNotes : null,
            x.CreatedAtUtc)).ToList();

        return Ok(new ApiResponse<PagedResult<ReferralDto>>(true, "Referrals.",
            new PagedResult<ReferralDto>(items, page, pageSize, total)));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        var referral = await db.Referrals.AsNoTracking().Include(x => x.Employee).FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("That referral could not be found.");

        await EnsureCanAccessAsync(referral.EmployeeId, ct);
        return Ok(new ApiResponse<ReferralDto>(true, "Referral.", ToDto(referral, User.IsAdmin())));
    }

    [HttpPost]
    public async Task<IActionResult> Create(ReferralRequest request, CancellationToken ct)
    {
        var employeeId = await SelfEmployeeIdAsync(ct);

        var referral = new ReferralApplication
        {
            EmployeeId = employeeId,
            CandidateName = request.CandidateName.Trim(),
            CandidateEmail = request.CandidateEmail.Trim().ToLowerInvariant(),
            CandidatePhone = request.CandidatePhone?.Trim(),
            Position = request.Position.Trim(),
            LinkedInUrl = request.LinkedInUrl?.Trim(),
            Notes = request.Notes?.Trim(),
            Status = ReferralStatus.Submitted,
        };

        db.Referrals.Add(referral);
        await db.SaveChangesAsync(ct);
        await audit.RecordAsync("Referral", "Create", referral.Id.ToString(), referral.Position, ct: ct);

        foreach (var adminId in await db.Users.Where(x => x.Role == RoleName.Admin && x.IsActive).Select(x => x.Id).ToListAsync(ct))
        {
            await notifications.NotifyAsync(adminId, "New candidate referral",
                $"{referral.CandidateName} was referred for {referral.Position}.",
                "Referral", "/admin/referrals", ct);
        }

        return Ok(new ApiResponse<ReferralDto>(true, "Referral submitted.", await GetDtoAsync(referral.Id, ct)));
    }

    [HttpPost("{id:int}/resume")]
    [RequestSizeLimit(8 * 1024 * 1024)]
    public async Task<IActionResult> UploadResume(int id, IFormFile file, CancellationToken ct)
    {
        var referral = await db.Referrals.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("That referral could not be found.");

        await EnsureCanAccessAsync(referral.EmployeeId, ct);

        var stored = await files.SaveAsync(file, FileCategory.ReferralResume, referral.EmployeeId, User.UserId(), ct);

        var previousId = referral.ResumeFileId;
        referral.ResumeFileId = stored.Id;
        referral.UpdatedAtUtc = DateTime.UtcNow;
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

        return Ok(new ApiResponse<object>(true, "Resume uploaded.", new { resumeFileId = stored.Id }));
    }

    [HttpGet("{id:int}/resume")]
    public async Task<IActionResult> DownloadResume(int id, CancellationToken ct)
    {
        var referral = await db.Referrals.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("That referral could not be found.");

        await EnsureCanAccessAsync(referral.EmployeeId, ct);

        if (referral.ResumeFileId is null) throw AppException.NotFound("No resume was attached to that referral.");

        var file = await db.StoredFiles.AsNoTracking().FirstOrDefaultAsync(x => x.Id == referral.ResumeFileId, ct)
            ?? throw AppException.NotFound("That resume is no longer available.");

        var stream = await files.OpenReadAsync(file, ct);
        return File(stream, file.ContentType, file.OriginalFileName);
    }

    [HttpPost("{id:int}/review"), Authorize(Policy = "Admin")]
    public async Task<IActionResult> Review(int id, ReviewReferralRequest request, CancellationToken ct)
    {
        if (!Enum.TryParse<ReferralStatus>(request.Status, true, out var status))
            throw AppException.BadRequest("Status must be Submitted, Screening, Interviewing, Hired or Rejected.");

        var referral = await db.Referrals.Include(x => x.Employee).FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("That referral could not be found.");

        referral.Status = status;
        referral.InternalNotes = request.InternalNotes?.Trim();
        referral.ReviewedByUserId = User.UserId();
        referral.ReviewedAtUtc = DateTime.UtcNow;
        referral.UpdatedAtUtc = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        await audit.RecordAsync("Referral", "Review", id.ToString(), $"status={status}", ct: ct);

        // The employee is told the status only; internal notes are never forwarded.
        await notifications.NotifyAsync(referral.Employee.UserId, "Referral update",
            $"{referral.CandidateName} ({referral.Position}) is now {status.ToString().ToLowerInvariant()}.",
            "Referral", "/employee/referrals", ct);

        return Ok(new ApiResponse<ReferralDto>(true, "Referral updated.", await GetDtoAsync(id, ct)));
    }

    private async Task<ReferralDto> GetDtoAsync(int id, CancellationToken ct)
    {
        var referral = await db.Referrals.AsNoTracking().Include(x => x.Employee).FirstAsync(x => x.Id == id, ct);
        return ToDto(referral, User.IsAdmin());
    }

    private static ReferralDto ToDto(ReferralApplication x, bool isAdmin) => new(
        x.Id, x.EmployeeId, x.Employee.FullName, x.CandidateName, x.CandidateEmail, x.CandidatePhone,
        x.Position, x.LinkedInUrl, x.Notes, x.ResumeFileId, x.Status.ToString(),
        isAdmin ? x.InternalNotes : null, x.CreatedAtUtc);

    private async Task EnsureCanAccessAsync(int employeeId, CancellationToken ct)
    {
        if (User.IsAdmin()) return;
        if (await SelfEmployeeIdAsync(ct) != employeeId)
            throw AppException.Forbidden("You can only view your own referrals.");
    }

    private async Task<int> SelfEmployeeIdAsync(CancellationToken ct)
    {
        var userId = User.UserId();
        return await db.Employees.Where(x => x.UserId == userId).Select(x => (int?)x.Id).FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("No employee record is linked to your account.");
    }
}
