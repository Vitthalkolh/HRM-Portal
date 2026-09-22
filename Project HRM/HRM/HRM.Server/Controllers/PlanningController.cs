using HRM.Server.Data;
using HRM.Server.DTOs;
using HRM.Server.Entities;
using HRM.Server.Infrastructure;
using HRM.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace HRM.Server.Controllers;

/// <summary>
/// The company planning calendar: releases and company events, separate from the common HR
/// calendar. Administrators manage it; employees have read-only access.
/// </summary>
[ApiController]
[Authorize]
[Route("api/company-planning")]
public sealed class PlanningController(
    HrmDbContext db,
    IAuditService audit,
    IOptions<AppOptions> appOptions) : ControllerBase
{
    private readonly AppOptions _app = appOptions.Value;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] DateOnly? start, [FromQuery] DateOnly? end, [FromQuery] string? type, CancellationToken ct = default)
    {
        var query = db.PlanningEvents.AsNoTracking().AsQueryable();

        if (start is not null) query = query.Where(x => x.EndDate >= start);
        if (end is not null) query = query.Where(x => x.StartDate <= end);

        if (!string.IsNullOrWhiteSpace(type) && Enum.TryParse<PlanningType>(type, true, out var parsed))
            query = query.Where(x => x.Type == parsed);

        var items = await query.OrderBy(x => x.StartDate).Select(Projection).ToListAsync(ct);
        return Ok(new ApiResponse<IReadOnlyList<PlanningEventDto>>(true, "Planning events.", items));
    }

    [HttpPost, Authorize(Policy = "Admin")]
    public async Task<IActionResult> Create(PlanningEventRequest request, CancellationToken ct)
    {
        var entity = new CompanyPlanningEvent();
        Apply(entity, request);

        db.PlanningEvents.Add(entity);
        await db.SaveChangesAsync(ct);
        await audit.RecordAsync("Planning", "Create", entity.Id.ToString(), $"{entity.Type} {entity.Title} on {entity.StartDate:yyyy-MM-dd}", ct: ct);

        return Ok(new ApiResponse<PlanningEventDto>(true, "Planning event created.", ToDto(entity)));
    }

    [HttpPut("{id:int}"), Authorize(Policy = "Admin")]
    public async Task<IActionResult> Update(int id, PlanningEventRequest request, CancellationToken ct)
    {
        var entity = await db.PlanningEvents.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("That planning event could not be found.");

        Apply(entity, request);
        entity.UpdatedAtUtc = DateTime.UtcNow;

        // An edited generated row is treated as an admin override and is preserved on regeneration.
        if (entity.IsGenerated) entity.IsOverridden = true;

        await db.SaveChangesAsync(ct);
        await audit.RecordAsync("Planning", "Update", id.ToString(), $"{entity.Type} {entity.Title} on {entity.StartDate:yyyy-MM-dd}", ct: ct);

        return Ok(new ApiResponse<PlanningEventDto>(true, "Planning event updated.", ToDto(entity)));
    }

    [HttpDelete("{id:int}"), Authorize(Policy = "Admin")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var entity = await db.PlanningEvents.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("That planning event could not be found.");

        db.PlanningEvents.Remove(entity);
        await db.SaveChangesAsync(ct);
        await audit.RecordAsync("Planning", "Delete", id.ToString(), $"{entity.Type} {entity.Title}", ct: ct);

        return Ok(new ApiResponse<object>(true, "Planning event deleted."));
    }

    /// <summary>
    /// Previews the generated release schedule for a year without saving anything, so an
    /// administrator can see the dates and the cancelled SNU occurrences before committing.
    /// </summary>
    [HttpPost("generate/preview"), Authorize(Policy = "Admin")]
    public IActionResult Preview(GeneratePlanningRequest request)
    {
        var result = CompanyPlanningGenerator.Generate(request.Year, request.FirstNtnsDate, _app.SnuCancellationWindowDays);

        var events = result.Events
            .Select((x, index) => new PlanningEventDto(
                -(index + 1), x.Title, x.Type.ToString(), PlanningTypeNames.Describe(x.Type),
                x.Date, x.Date, x.Description, null, null, true, false))
            .ToList();

        return Ok(new ApiResponse<GeneratedPlanningPreviewDto>(true,
            $"Generated {events.Count} event(s) for {request.Year}.",
            new GeneratedPlanningPreviewDto(events, result.CancelledSnu)));
    }

    /// <summary>
    /// Writes the generated schedule. Manually created events and admin-overridden generated
    /// events are never touched; only untouched generated rows are replaced.
    /// </summary>
    [HttpPost("generate"), Authorize(Policy = "Admin")]
    public async Task<IActionResult> Generate(GeneratePlanningRequest request, CancellationToken ct)
    {
        var result = CompanyPlanningGenerator.Generate(request.Year, request.FirstNtnsDate, _app.SnuCancellationWindowDays);

        var yearStart = new DateOnly(request.Year, 1, 1);
        var yearEnd = new DateOnly(request.Year, 12, 31);

        if (request.Replace)
        {
            var replaceable = await db.PlanningEvents
                .Where(x => x.IsGenerated && !x.IsOverridden && x.StartDate >= yearStart && x.StartDate <= yearEnd)
                .ToListAsync(ct);

            db.PlanningEvents.RemoveRange(replaceable);
            await db.SaveChangesAsync(ct);
        }

        var existing = await db.PlanningEvents
            .Where(x => x.StartDate >= yearStart && x.StartDate <= yearEnd)
            .Select(x => new { x.Type, x.StartDate })
            .ToListAsync(ct);

        var added = new List<CompanyPlanningEvent>();

        foreach (var generated in result.Events)
        {
            // Skip anything already on the calendar for that type and date.
            if (existing.Any(x => x.Type == generated.Type && x.StartDate == generated.Date)) continue;

            added.Add(new CompanyPlanningEvent
            {
                Title = generated.Title,
                Type = generated.Type,
                StartDate = generated.Date,
                EndDate = generated.Date,
                Description = generated.Description,
                IsGenerated = true,
            });
        }

        db.PlanningEvents.AddRange(added);
        await db.SaveChangesAsync(ct);

        await audit.RecordAsync("Planning", "Generate", request.Year.ToString(),
            $"Added {added.Count} generated event(s); {result.CancelledSnu.Count} SNU occurrence(s) cancelled.", ct: ct);

        return Ok(new ApiResponse<GeneratedPlanningPreviewDto>(true,
            $"Added {added.Count} planning event(s) for {request.Year}.",
            new GeneratedPlanningPreviewDto(added.Select(ToDto).ToList(), result.CancelledSnu)));
    }

    private static void Apply(CompanyPlanningEvent entity, PlanningEventRequest request)
    {
        if (!Enum.TryParse<PlanningType>(request.Type, true, out var type))
            throw AppException.BadRequest("Type must be NT (NTNS release), IT (dry run), SNU or E (company event).");

        if (request.EndDate < request.StartDate)
            throw AppException.BadRequest("The end date cannot be before the start date.");

        entity.Title = request.Title.Trim();
        entity.Type = type;
        entity.StartDate = request.StartDate;
        entity.EndDate = request.EndDate;
        entity.Description = request.Description?.Trim();
        entity.Location = request.Location?.Trim();
        entity.Notes = request.Notes?.Trim();
    }

    private static PlanningEventDto ToDto(CompanyPlanningEvent x) => new(
        x.Id, x.Title, x.Type.ToString(), PlanningTypeNames.Describe(x.Type),
        x.StartDate, x.EndDate, x.Description, x.Location, x.Notes, x.IsGenerated, x.IsOverridden);

    private static readonly System.Linq.Expressions.Expression<Func<CompanyPlanningEvent, PlanningEventDto>> Projection =
        x => new PlanningEventDto(
            x.Id, x.Title, x.Type.ToString(),
            x.Type == PlanningType.NT ? "NTNS Release"
                : x.Type == PlanningType.IT ? "Dry Run"
                : x.Type == PlanningType.SNU ? "SNU Release"
                : "Company Event",
            x.StartDate, x.EndDate, x.Description, x.Location, x.Notes, x.IsGenerated, x.IsOverridden);
}
