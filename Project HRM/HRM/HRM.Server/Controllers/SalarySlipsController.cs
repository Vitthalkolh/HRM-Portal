using System.Globalization;
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
/// Salary slips are located by employee, year and month. Every read is authorized against the
/// owning employee, and the file is streamed through this endpoint so no storage path is exposed.
/// </summary>
[ApiController]
[Authorize]
[Route("api/salary-slips")]
public sealed class SalarySlipsController(
    HrmDbContext db,
    IFileStorage files,
    IAuditService audit,
    INotificationService notifications) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int? employeeId, [FromQuery] int? year, CancellationToken ct = default)
    {
        var scope = await ResolveEmployeeAsync(employeeId, ct);

        var query = db.SalarySlips.AsNoTracking().AsQueryable();
        if (scope is not null) query = query.Where(x => x.EmployeeId == scope);
        if (year is not null) query = query.Where(x => x.Year == year);

        var rows = await query
            .OrderByDescending(x => x.Year).ThenByDescending(x => x.Month)
            .Select(x => new
            {
                x.Id,
                x.EmployeeId,
                Name = x.Employee.FirstName + " " + x.Employee.LastName,
                x.Year,
                x.Month,
                x.FileId,
                x.CreatedAtUtc,
            })
            .ToListAsync(ct);

        var sizes = await db.StoredFiles
            .Where(f => rows.Select(r => r.FileId).Contains(f.Id))
            .ToDictionaryAsync(f => f.Id, f => f.Size, ct);

        var items = rows.Select(x => new SalarySlipDto(
            x.Id, x.EmployeeId, x.Name, x.Year, x.Month,
            CultureInfo.InvariantCulture.DateTimeFormat.GetMonthName(x.Month),
            sizes.GetValueOrDefault(x.FileId), x.CreatedAtUtc)).ToList();

        return Ok(new ApiResponse<IReadOnlyList<SalarySlipDto>>(true, "Salary slips.", items));
    }

    [HttpGet("{id:int}/download")]
    public async Task<IActionResult> Download(int id, CancellationToken ct)
    {
        var slip = await db.SalarySlips.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("That salary slip could not be found.");

        // The ownership check is what stops one employee reading another's slip by changing the id.
        await EnsureCanAccessAsync(slip.EmployeeId, ct);

        var file = await db.StoredFiles.AsNoTracking().FirstOrDefaultAsync(x => x.Id == slip.FileId, ct)
            ?? throw AppException.NotFound("That salary slip file is no longer available.");

        var stream = await files.OpenReadAsync(file, ct);
        await audit.RecordAsync("SalarySlip", "Download", id.ToString(), $"{slip.Year}-{slip.Month:00}", ct: ct);

        return File(stream, file.ContentType, $"salary-slip-{slip.Year}-{slip.Month:00}.pdf");
    }

    [HttpPost, Authorize(Policy = "Admin")]
    [RequestSizeLimit(8 * 1024 * 1024)]
    public async Task<IActionResult> Upload(
        [FromForm] int employeeId, [FromForm] int year, [FromForm] int month, IFormFile file, CancellationToken ct)
    {
        if (month is < 1 or > 12) throw AppException.BadRequest("Month must be between 1 and 12.");
        if (year is < 2000 or > 2100) throw AppException.BadRequest("Please supply a valid year.");

        var employee = await db.Employees.Include(x => x.User).FirstOrDefaultAsync(x => x.Id == employeeId, ct)
            ?? throw AppException.NotFound("That employee could not be found.");

        var existing = await db.SalarySlips.FirstOrDefaultAsync(
            x => x.EmployeeId == employeeId && x.Year == year && x.Month == month, ct);

        var stored = await files.SaveAsync(file, FileCategory.SalarySlip, employeeId, User.UserId(), ct);

        if (existing is not null)
        {
            var previous = await db.StoredFiles.FirstOrDefaultAsync(x => x.Id == existing.FileId, ct);
            existing.FileId = stored.Id;
            existing.UploadedByUserId = User.UserId();
            existing.UpdatedAtUtc = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);

            if (previous is not null)
            {
                files.Delete(previous.StoragePath);
                db.StoredFiles.Remove(previous);
                await db.SaveChangesAsync(ct);
            }
        }
        else
        {
            db.SalarySlips.Add(new SalarySlip
            {
                EmployeeId = employeeId,
                Year = year,
                Month = month,
                FileId = stored.Id,
                UploadedByUserId = User.UserId(),
            });
            await db.SaveChangesAsync(ct);
        }

        await audit.RecordAsync("SalarySlip", "Upload", $"{employeeId}/{year}-{month:00}", null, ct: ct);

        await notifications.NotifyAsync(employee.UserId, "Salary slip available",
            $"Your salary slip for {CultureInfo.InvariantCulture.DateTimeFormat.GetMonthName(month)} {year} is ready to download.",
            "SalarySlip", "/employee/salary-slips", ct);

        return Ok(new ApiResponse<object>(true, "Salary slip uploaded."));
    }

    [HttpDelete("{id:int}"), Authorize(Policy = "Admin")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var slip = await db.SalarySlips.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("That salary slip could not be found.");

        var file = await db.StoredFiles.FirstOrDefaultAsync(x => x.Id == slip.FileId, ct);

        db.SalarySlips.Remove(slip);
        if (file is not null) db.StoredFiles.Remove(file);
        await db.SaveChangesAsync(ct);

        if (file is not null) files.Delete(file.StoragePath);
        await audit.RecordAsync("SalarySlip", "Delete", id.ToString(), null, ct: ct);

        return Ok(new ApiResponse<object>(true, "Salary slip removed."));
    }

    /// <summary>Returns null for an administrator listing everyone, otherwise the caller's own id.</summary>
    private async Task<int?> ResolveEmployeeAsync(int? requested, CancellationToken ct)
    {
        if (!User.IsAdmin())
        {
            var self = await SelfEmployeeIdAsync(ct);
            if (requested is not null && requested != self)
                throw AppException.Forbidden("You can only view your own salary slips.");
            return self;
        }

        return requested;
    }

    private async Task EnsureCanAccessAsync(int employeeId, CancellationToken ct)
    {
        if (User.IsAdmin()) return;
        if (await SelfEmployeeIdAsync(ct) != employeeId)
            throw AppException.Forbidden("You can only open your own salary slips.");
    }

    private async Task<int> SelfEmployeeIdAsync(CancellationToken ct)
    {
        var userId = User.UserId();
        return await db.Employees.Where(x => x.UserId == userId).Select(x => (int?)x.Id).FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("No employee record is linked to your account.");
    }
}
