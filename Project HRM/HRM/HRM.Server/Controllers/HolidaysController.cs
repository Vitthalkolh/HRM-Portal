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
/// National holidays: a company-wide calendar event. Administrators manage them, employees view
/// them, and they are never part of an employee's leave balance.
/// </summary>
[ApiController]
[Authorize]
[Route("api/national-holidays")]
public sealed class NationalHolidaysController(HrmDbContext db, IAuditService audit) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int? year, CancellationToken ct)
    {
        var target = year ?? DateTime.UtcNow.Year;

        var items = await db.NationalHolidays
            .AsNoTracking()
            .Where(x => x.Date.Year == target)
            .OrderBy(x => x.Date)
            .Select(x => new NationalHolidayDto(x.Id, x.Name, x.Date, x.Description))
            .ToListAsync(ct);

        return Ok(new ApiResponse<IReadOnlyList<NationalHolidayDto>>(true, "National holidays.", items));
    }

    [HttpPost, Authorize(Policy = "Admin")]
    public async Task<IActionResult> Create(HolidayRequest request, CancellationToken ct)
    {
        if (await db.NationalHolidays.AnyAsync(x => x.Date == request.Date, ct))
            throw AppException.Conflict("A national holiday is already recorded for that date.");

        var entity = new NationalHoliday
        {
            Name = request.Name.Trim(),
            Date = request.Date,
            Description = request.Description?.Trim(),
        };

        db.NationalHolidays.Add(entity);
        await db.SaveChangesAsync(ct);
        await audit.RecordAsync("NationalHoliday", "Create", entity.Id.ToString(), $"{entity.Name} on {entity.Date:yyyy-MM-dd}", ct: ct);

        return Ok(new ApiResponse<NationalHolidayDto>(true, "National holiday added.",
            new NationalHolidayDto(entity.Id, entity.Name, entity.Date, entity.Description)));
    }

    [HttpPut("{id:int}"), Authorize(Policy = "Admin")]
    public async Task<IActionResult> Update(int id, HolidayRequest request, CancellationToken ct)
    {
        var entity = await db.NationalHolidays.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("That holiday could not be found.");

        if (await db.NationalHolidays.AnyAsync(x => x.Date == request.Date && x.Id != id, ct))
            throw AppException.Conflict("Another national holiday is already recorded for that date.");

        entity.Name = request.Name.Trim();
        entity.Date = request.Date;
        entity.Description = request.Description?.Trim();
        entity.UpdatedAtUtc = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        await audit.RecordAsync("NationalHoliday", "Update", id.ToString(), $"{entity.Name} on {entity.Date:yyyy-MM-dd}", ct: ct);

        return Ok(new ApiResponse<NationalHolidayDto>(true, "National holiday updated.",
            new NationalHolidayDto(entity.Id, entity.Name, entity.Date, entity.Description)));
    }

    [HttpDelete("{id:int}"), Authorize(Policy = "Admin")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var entity = await db.NationalHolidays.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("That holiday could not be found.");

        db.NationalHolidays.Remove(entity);
        await db.SaveChangesAsync(ct);
        await audit.RecordAsync("NationalHoliday", "Delete", id.ToString(), $"{entity.Name} on {entity.Date:yyyy-MM-dd}", ct: ct);

        return Ok(new ApiResponse<object>(true, "National holiday removed."));
    }
}

/// <summary>
/// Management leave: also a company-wide calendar event, never an employee leave type.
/// </summary>
[ApiController]
[Authorize]
[Route("api/management-leaves")]
public sealed class ManagementLeavesController(HrmDbContext db, IAuditService audit) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int? year, CancellationToken ct)
    {
        var target = year ?? DateTime.UtcNow.Year;

        var items = await db.ManagementLeaves
            .AsNoTracking()
            .Where(x => x.Date.Year == target)
            .OrderBy(x => x.Date)
            .Select(x => new ManagementLeaveDto(x.Id, x.Title, x.Date, x.Description))
            .ToListAsync(ct);

        return Ok(new ApiResponse<IReadOnlyList<ManagementLeaveDto>>(true, "Management leaves.", items));
    }

    [HttpPost, Authorize(Policy = "Admin")]
    public async Task<IActionResult> Create(ManagementLeaveRequest request, CancellationToken ct)
    {
        var entity = new ManagementLeave
        {
            Title = request.Title.Trim(),
            Date = request.Date,
            Description = request.Description?.Trim(),
        };

        db.ManagementLeaves.Add(entity);
        await db.SaveChangesAsync(ct);
        await audit.RecordAsync("ManagementLeave", "Create", entity.Id.ToString(), $"{entity.Title} on {entity.Date:yyyy-MM-dd}", ct: ct);

        return Ok(new ApiResponse<ManagementLeaveDto>(true, "Management leave added.",
            new ManagementLeaveDto(entity.Id, entity.Title, entity.Date, entity.Description)));
    }

    [HttpPut("{id:int}"), Authorize(Policy = "Admin")]
    public async Task<IActionResult> Update(int id, ManagementLeaveRequest request, CancellationToken ct)
    {
        var entity = await db.ManagementLeaves.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("That management leave could not be found.");

        entity.Title = request.Title.Trim();
        entity.Date = request.Date;
        entity.Description = request.Description?.Trim();
        entity.UpdatedAtUtc = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        await audit.RecordAsync("ManagementLeave", "Update", id.ToString(), $"{entity.Title} on {entity.Date:yyyy-MM-dd}", ct: ct);

        return Ok(new ApiResponse<ManagementLeaveDto>(true, "Management leave updated.",
            new ManagementLeaveDto(entity.Id, entity.Title, entity.Date, entity.Description)));
    }

    [HttpDelete("{id:int}"), Authorize(Policy = "Admin")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var entity = await db.ManagementLeaves.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("That management leave could not be found.");

        db.ManagementLeaves.Remove(entity);
        await db.SaveChangesAsync(ct);
        await audit.RecordAsync("ManagementLeave", "Delete", id.ToString(), $"{entity.Title} on {entity.Date:yyyy-MM-dd}", ct: ct);

        return Ok(new ApiResponse<object>(true, "Management leave removed."));
    }
}
