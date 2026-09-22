using HRM.Server.DTOs;
using HRM.Server.Infrastructure;
using HRM.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRM.Server.Controllers;

/// <summary>
/// The one common calendar shared by Admin and Employee. There is no separate "my calendar"
/// and "company calendar"; company planning lives on its own dedicated calendar instead.
/// </summary>
[ApiController]
[Authorize]
[Route("api/calendar")]
public sealed class CalendarController(ICalendarService calendar) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] DateOnly? start, [FromQuery] DateOnly? end, CancellationToken ct)
    {
        // Defaults to the current month so the client can open with no parameters.
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var from = start ?? new DateOnly(today.Year, today.Month, 1);
        var to = end ?? from.AddMonths(1).AddDays(-1);

        if (to.DayNumber - from.DayNumber > 400)
            throw AppException.BadRequest("Please request a range of one year or less.");

        var events = await calendar.GetEventsAsync(from, to, User.IsAdmin(), ct);
        return Ok(new ApiResponse<IReadOnlyList<CalendarEventDto>>(true, "Calendar events.", events));
    }

    /// <summary>Backing data for the trending / monthly highlights popup.</summary>
    [HttpGet("highlights")]
    public async Task<IActionResult> Highlights([FromQuery] int? year, [FromQuery] int? month, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var targetYear = year ?? today.Year;
        var targetMonth = month ?? today.Month;

        if (targetMonth is < 1 or > 12) throw AppException.BadRequest("Month must be between 1 and 12.");

        var highlights = await calendar.GetMonthlyHighlightsAsync(targetYear, targetMonth, ct);
        return Ok(new ApiResponse<HighlightsDto>(true, "Monthly highlights.", highlights));
    }
}
