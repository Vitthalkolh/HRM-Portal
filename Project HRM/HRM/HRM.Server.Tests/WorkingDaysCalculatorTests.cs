using HRM.Server.Services;
using Xunit;

namespace HRM.Server.Tests;

public sealed class WorkingDaysCalculatorTests
{
    private static readonly IReadOnlySet<DateOnly> NoHolidays = new HashSet<DateOnly>();

    [Fact]
    public void A_full_working_week_counts_five_days()
    {
        // Monday 2 November 2026 to Friday 6 November 2026.
        var days = WorkingDaysCalculator.CountWorkingDays(new DateOnly(2026, 11, 2), new DateOnly(2026, 11, 6), NoHolidays);
        Assert.Equal(5, days);
    }

    [Fact]
    public void Weekends_are_excluded()
    {
        // Monday to the following Sunday spans 14 days but only 10 working days.
        var days = WorkingDaysCalculator.CountWorkingDays(new DateOnly(2026, 11, 2), new DateOnly(2026, 11, 15), NoHolidays);
        Assert.Equal(10, days);
    }

    [Fact]
    public void A_weekend_only_range_has_no_working_days()
    {
        var days = WorkingDaysCalculator.CountWorkingDays(new DateOnly(2026, 11, 7), new DateOnly(2026, 11, 8), NoHolidays);
        Assert.Equal(0, days);
    }

    [Fact]
    public void National_holidays_are_excluded()
    {
        var holidays = new HashSet<DateOnly> { new(2026, 11, 4) };
        var days = WorkingDaysCalculator.CountWorkingDays(new DateOnly(2026, 11, 2), new DateOnly(2026, 11, 6), holidays);
        Assert.Equal(4, days);
    }

    [Fact]
    public void A_single_working_day_counts_one()
    {
        var days = WorkingDaysCalculator.CountWorkingDays(new DateOnly(2026, 11, 3), new DateOnly(2026, 11, 3), NoHolidays);
        Assert.Equal(1, days);
    }

    [Fact]
    public void An_inverted_range_yields_nothing_rather_than_throwing()
    {
        Assert.Empty(WorkingDaysCalculator.WorkingDates(new DateOnly(2026, 11, 6), new DateOnly(2026, 11, 2), NoHolidays));
    }

    [Fact]
    public void Duration_reports_whole_years_months_and_days()
    {
        var duration = WorkingDaysCalculator.Duration(new DateOnly(2021, 6, 1), new DateOnly(2026, 9, 22), NoHolidays);

        Assert.Equal(5, duration.Years);
        Assert.Equal(3, duration.Months);
        Assert.Equal(21, duration.Days);
    }

    [Fact]
    public void Duration_borrows_correctly_when_the_day_of_month_has_not_been_reached()
    {
        var duration = WorkingDaysCalculator.Duration(new DateOnly(2024, 1, 31), new DateOnly(2024, 3, 1), NoHolidays);

        Assert.Equal(0, duration.Years);
        Assert.Equal(1, duration.Months);
        Assert.Equal(1, duration.Days);
    }

    [Fact]
    public void Duration_on_the_joining_date_itself_counts_one_calendar_day()
    {
        var duration = WorkingDaysCalculator.Duration(new DateOnly(2026, 9, 22), new DateOnly(2026, 9, 22), NoHolidays);

        Assert.Equal(0, duration.Years);
        Assert.Equal(0, duration.Months);
        Assert.Equal(0, duration.Days);
        Assert.Equal(1, duration.TotalCalendarDays);
    }

    [Fact]
    public void Duration_before_the_joining_date_is_zero_rather_than_negative()
    {
        var duration = WorkingDaysCalculator.Duration(new DateOnly(2026, 9, 22), new DateOnly(2026, 1, 1), NoHolidays);

        Assert.Equal(0, duration.Years);
        Assert.Equal(0, duration.TotalCalendarDays);
        Assert.Equal(0, duration.TotalWorkingDays);
    }

    [Fact]
    public void Duration_counts_fewer_working_days_than_calendar_days()
    {
        var duration = WorkingDaysCalculator.Duration(new DateOnly(2026, 1, 1), new DateOnly(2026, 12, 31), NoHolidays);

        Assert.Equal(365, duration.TotalCalendarDays);
        Assert.Equal(261, duration.TotalWorkingDays);
    }
}
