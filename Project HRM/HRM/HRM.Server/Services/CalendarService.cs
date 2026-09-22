using HRM.Server.Data;
using HRM.Server.DTOs;
using HRM.Server.Entities;
using Microsoft.EntityFrameworkCore;

namespace HRM.Server.Services;

public interface ICalendarService
{
    /// <summary>
    /// The single common calendar shared by Admin and Employee. There is deliberately no separate
    /// "my calendar" and "company calendar".
    /// </summary>
    Task<IReadOnlyList<CalendarEventDto>> GetEventsAsync(DateOnly start, DateOnly end, bool isAdmin, CancellationToken ct = default);

    Task<HighlightsDto> GetMonthlyHighlightsAsync(int year, int month, CancellationToken ct = default);
}

public sealed class CalendarService(HrmDbContext db) : ICalendarService
{
    public async Task<IReadOnlyList<CalendarEventDto>> GetEventsAsync(
        DateOnly start, DateOnly end, bool isAdmin, CancellationToken ct = default)
    {
        if (end < start) (start, end) = (end, start);

        var events = new List<CalendarEventDto>();

        var holidays = await db.NationalHolidays
            .Where(x => x.Date >= start && x.Date <= end)
            .ToListAsync(ct);

        events.AddRange(holidays.Select(x => new CalendarEventDto(
            $"holiday-{x.Id}", "NationalHoliday", x.Name, x.Date, x.Date, x.Description, null, null)));

        var management = await db.ManagementLeaves
            .Where(x => x.Date >= start && x.Date <= end)
            .ToListAsync(ct);

        events.AddRange(management.Select(x => new CalendarEventDto(
            $"management-{x.Id}", "ManagementLeave", x.Title, x.Date, x.Date, x.Description, null, null)));

        // Approved leave only. Employees see who is away and the leave type, but never the
        // stated reason, which is treated as private to the employee and the reviewing admin.
        var leaves = await db.LeaveRequests
            .Where(x => x.Status == LeaveStatus.Approved && x.FromDate <= end && x.ToDate >= start)
            .Select(x => new
            {
                x.Id,
                x.EmployeeId,
                Name = x.Employee.FirstName + " " + x.Employee.LastName,
                Code = x.LeaveType.Code,
                TypeName = x.LeaveType.Name,
                x.FromDate,
                x.ToDate,
                x.IsHalfDay,
                x.Reason,
                HasImage = x.Employee.ProfileImagePath != null,
            })
            .ToListAsync(ct);

        events.AddRange(leaves.Select(x => new CalendarEventDto(
            $"leave-{x.Id}",
            "Leave",
            $"{x.Name} - {x.Code}{(x.IsHalfDay ? " (half day)" : string.Empty)}",
            x.FromDate,
            x.ToDate,
            isAdmin ? x.Reason : x.TypeName,
            x.EmployeeId,
            x.HasImage ? $"/api/employees/{x.EmployeeId}/profile-image" : null)));

        var employees = await db.Employees
            .Where(x => x.User.IsActive)
            .Select(x => new
            {
                x.Id,
                Name = x.FirstName + " " + x.LastName,
                x.DateOfBirth,
                x.JoiningDate,
                x.Designation,
                x.EmploymentStatus,
                x.LastWorkingDate,
                HasImage = x.ProfileImagePath != null,
            })
            .ToListAsync(ct);

        foreach (var employee in employees)
        {
            var image = employee.HasImage ? $"/api/employees/{employee.Id}/profile-image" : null;

            if (employee.DateOfBirth is { } dob)
            {
                foreach (var occurrence in AnnualOccurrences(dob, start, end))
                {
                    events.Add(new CalendarEventDto(
                        $"birthday-{employee.Id}-{occurrence:yyyyMMdd}", "Birthday",
                        $"{employee.Name}'s birthday", occurrence, occurrence,
                        employee.Designation, employee.Id, image));
                }
            }

            foreach (var occurrence in AnnualOccurrences(employee.JoiningDate, start, end))
            {
                // The joining date itself is not an anniversary.
                if (occurrence.Year == employee.JoiningDate.Year) continue;

                var years = occurrence.Year - employee.JoiningDate.Year;
                events.Add(new CalendarEventDto(
                    $"anniversary-{employee.Id}-{occurrence:yyyyMMdd}", "WorkAnniversary",
                    $"{employee.Name} - {years} year{(years == 1 ? string.Empty : "s")}", occurrence, occurrence,
                    employee.Designation, employee.Id, image));
            }

            // Notice-period and exit dates are management information.
            if (isAdmin
                && employee.EmploymentStatus != EmploymentStatus.Active
                && employee.LastWorkingDate is { } lastDay
                && lastDay >= start && lastDay <= end)
            {
                events.Add(new CalendarEventDto(
                    $"exit-{employee.Id}", "NoticePeriod",
                    $"{employee.Name} - last working day", lastDay, lastDay,
                    employee.EmploymentStatus.ToString(), employee.Id, image));
            }
        }

        return events.OrderBy(x => x.Start).ThenBy(x => x.Type).ToList();
    }

    public async Task<HighlightsDto> GetMonthlyHighlightsAsync(int year, int month, CancellationToken ct = default)
    {
        var start = new DateOnly(year, month, 1);
        var end = start.AddMonths(1).AddDays(-1);

        var items = new List<HighlightDto>();

        var employees = await db.Employees
            .Where(x => x.User.IsActive)
            .Select(x => new
            {
                x.Id,
                Name = x.FirstName + " " + x.LastName,
                x.DateOfBirth,
                x.JoiningDate,
                x.Designation,
                HasImage = x.ProfileImagePath != null,
            })
            .ToListAsync(ct);

        foreach (var employee in employees)
        {
            var image = employee.HasImage ? $"/api/employees/{employee.Id}/profile-image" : null;

            if (employee.DateOfBirth is { } dob && dob.Month == month)
            {
                items.Add(new HighlightDto("Birthday", employee.Name,
                    employee.Designation ?? "Birthday this month", new DateOnly(year, month, SafeDay(dob.Day, year, month)), image));
            }

            if (employee.JoiningDate.Month == month && employee.JoiningDate.Year < year)
            {
                var years = year - employee.JoiningDate.Year;
                items.Add(new HighlightDto("WorkAnniversary", employee.Name,
                    $"{years} year{(years == 1 ? string.Empty : "s")} with us",
                    new DateOnly(year, month, SafeDay(employee.JoiningDate.Day, year, month)), image));
            }
        }

        var holidays = await db.NationalHolidays.Where(x => x.Date >= start && x.Date <= end).ToListAsync(ct);
        items.AddRange(holidays.Select(x => new HighlightDto("NationalHoliday", x.Name, x.Description ?? "National holiday", x.Date, null)));

        var planning = await db.PlanningEvents
            .Where(x => x.StartDate <= end && x.EndDate >= start && x.Type == PlanningType.E)
            .ToListAsync(ct);

        items.AddRange(planning.Select(x => new HighlightDto("CompanyEvent", x.Title, x.Description ?? "Company event", x.StartDate, null)));

        return new HighlightsDto(year, month, start.ToString("MMMM yyyy"), items.OrderBy(x => x.Date).ToList());
    }

    /// <summary>Yields the anniversary of <paramref name="anchor"/> that falls inside the window, for each year it spans.</summary>
    private static IEnumerable<DateOnly> AnnualOccurrences(DateOnly anchor, DateOnly start, DateOnly end)
    {
        for (var year = start.Year; year <= end.Year; year++)
        {
            var occurrence = new DateOnly(year, anchor.Month, SafeDay(anchor.Day, year, anchor.Month));
            if (occurrence >= start && occurrence <= end) yield return occurrence;
        }
    }

    /// <summary>29 February in a non-leap year is observed on the 28th.</summary>
    private static int SafeDay(int day, int year, int month) => Math.Min(day, DateTime.DaysInMonth(year, month));
}
