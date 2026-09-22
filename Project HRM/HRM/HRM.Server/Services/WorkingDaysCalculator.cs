using HRM.Server.DTOs;

namespace HRM.Server.Services;

/// <summary>
/// Working-day arithmetic. Pure and static so the same rules are provably used by the
/// leave engine, the profile page and the tests.
///
/// Rule: a working day is Monday-Friday excluding national holidays.
/// Management Leave is a company calendar event and is NOT excluded from the working-day
/// count, because it is not a company closure in this model.
/// </summary>
public static class WorkingDaysCalculator
{
    public static bool IsWorkingDay(DateOnly date, IReadOnlySet<DateOnly> holidays) =>
        date.DayOfWeek is not DayOfWeek.Saturday and not DayOfWeek.Sunday && !holidays.Contains(date);

    /// <summary>Every working date in the inclusive range.</summary>
    public static IReadOnlyList<DateOnly> WorkingDates(DateOnly from, DateOnly to, IReadOnlySet<DateOnly> holidays)
    {
        if (to < from) return [];

        var results = new List<DateOnly>();
        for (var day = from; day <= to; day = day.AddDays(1))
        {
            if (IsWorkingDay(day, holidays)) results.Add(day);
        }

        return results;
    }

    public static int CountWorkingDays(DateOnly from, DateOnly to, IReadOnlySet<DateOnly> holidays) =>
        WorkingDates(from, to, holidays).Count;

    /// <summary>
    /// Employment duration from the joining date up to and including <paramref name="asOf"/>.
    /// Returns calendar years/months/days plus a working-day total on the same rules as leave.
    /// </summary>
    public static WorkingDurationDto Duration(DateOnly joiningDate, DateOnly asOf, IReadOnlySet<DateOnly> holidays)
    {
        if (asOf < joiningDate) return new WorkingDurationDto(0, 0, 0, 0, 0);

        // Count whole months by advancing from the joining date until the next step would pass
        // asOf, then take the remainder in days. Doing it this way keeps month-end dates correct
        // (31 January to 1 March is one month and one day, not a negative remainder).
        var wholeMonths = (asOf.Year - joiningDate.Year) * 12 + asOf.Month - joiningDate.Month;
        if (wholeMonths > 0 && joiningDate.AddMonths(wholeMonths) > asOf) wholeMonths--;
        if (wholeMonths < 0) wholeMonths = 0;

        var anchor = joiningDate.AddMonths(wholeMonths);
        var years = wholeMonths / 12;
        var months = wholeMonths % 12;
        var days = asOf.DayNumber - anchor.DayNumber;

        var totalCalendarDays = asOf.DayNumber - joiningDate.DayNumber + 1;
        var totalWorkingDays = CountWorkingDays(joiningDate, asOf, holidays);

        return new WorkingDurationDto(years, months, days, totalCalendarDays, totalWorkingDays);
    }
}
