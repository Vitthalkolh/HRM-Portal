using HRM.Server.Entities;
using HRM.Server.Services;
using Xunit;

namespace HRM.Server.Tests;

public sealed class CompanyPlanningGeneratorTests
{
    [Theory]
    [InlineData(2026)]
    [InlineData(2027)]
    [InlineData(2028)]
    public void Four_ntns_releases_are_generated_each_on_a_sunday(int year)
    {
        var ntns = Ntns(year);

        Assert.Equal(4, ntns.Count);
        Assert.All(ntns, date => Assert.Equal(DayOfWeek.Sunday, date.DayOfWeek));
        Assert.All(ntns, date => Assert.Equal(year, date.Year));
    }

    [Theory]
    [InlineData(2026)]
    [InlineData(2027)]
    public void Ntns_releases_are_about_three_months_apart(int year)
    {
        var ntns = Ntns(year);

        foreach (var (earlier, later) in ntns.Zip(ntns.Skip(1)))
        {
            var gap = (later.DayNumber - earlier.DayNumber) / 7.0;
            Assert.InRange(gap, 12, 14); // 12 to 14 weeks, i.e. roughly a quarter.
        }
    }

    [Theory]
    [InlineData(2026)]
    [InlineData(2027)]
    public void Every_ntns_release_has_a_dry_run_exactly_one_week_earlier(int year)
    {
        var result = CompanyPlanningGenerator.Generate(year);
        var ntns = Dates(result, PlanningType.NT);
        var dryRuns = Dates(result, PlanningType.IT);

        Assert.Equal(4, dryRuns.Count);
        Assert.Equal(ntns.Count, dryRuns.Count);

        foreach (var (release, dryRun) in ntns.Zip(dryRuns))
        {
            Assert.Equal(7, release.DayNumber - dryRun.DayNumber);
        }
    }

    [Fact]
    public void The_default_schedule_keeps_every_dry_run_inside_the_same_year()
    {
        // The first NTNS is anchored after 8 January precisely so the dry run does not fall
        // into the previous year and drop out of the year's calendar.
        foreach (var year in new[] { 2026, 2027, 2028, 2029 })
        {
            Assert.All(Dates(CompanyPlanningGenerator.Generate(year), PlanningType.IT),
                date => Assert.Equal(year, date.Year));
        }
    }

    [Theory]
    [InlineData(2026)]
    [InlineData(2027)]
    public void Snu_releases_fall_on_a_wednesday_every_fortnight(int year)
    {
        var result = CompanyPlanningGenerator.Generate(year);
        var snu = Dates(result, PlanningType.SNU);

        Assert.NotEmpty(snu);
        Assert.All(snu, date => Assert.Equal(DayOfWeek.Wednesday, date.DayOfWeek));

        // Gaps are multiples of the fortnight; a longer gap only appears where an occurrence
        // was cancelled for being too close to an NTNS release.
        foreach (var (earlier, later) in snu.Zip(snu.Skip(1)))
        {
            Assert.Equal(0, (later.DayNumber - earlier.DayNumber) % CompanyPlanningGenerator.SnuIntervalDays);
        }
    }

    [Theory]
    [InlineData(2026)]
    [InlineData(2027)]
    public void Snu_releases_near_an_ntns_release_are_cancelled(int year)
    {
        const int window = 7;
        var result = CompanyPlanningGenerator.Generate(year, null, window);
        var ntns = Dates(result, PlanningType.NT);
        var snu = Dates(result, PlanningType.SNU);

        Assert.NotEmpty(result.CancelledSnu);
        Assert.All(snu, s => Assert.All(ntns, n => Assert.True(Math.Abs(s.DayNumber - n.DayNumber) > window)));
    }

    [Fact]
    public void The_cancellation_window_is_configurable()
    {
        var narrow = CompanyPlanningGenerator.Generate(2026, null, 1);
        var wide = CompanyPlanningGenerator.Generate(2026, null, 20);

        Assert.True(wide.CancelledSnu.Count > narrow.CancelledSnu.Count);
    }

    [Fact]
    public void A_supplied_anchor_is_honoured_and_snapped_forward_to_a_sunday()
    {
        // 5 March 2026 is a Thursday; the first release should move to Sunday 8 March.
        var ntns = Dates(CompanyPlanningGenerator.Generate(2026, new DateOnly(2026, 3, 5)), PlanningType.NT);

        Assert.Equal(new DateOnly(2026, 3, 8), ntns[0]);
        Assert.All(ntns, date => Assert.Equal(DayOfWeek.Sunday, date.DayOfWeek));
    }

    [Fact]
    public void Generation_is_deterministic()
    {
        var first = CompanyPlanningGenerator.Generate(2026);
        var second = CompanyPlanningGenerator.Generate(2026);

        Assert.Equal(
            first.Events.Select(x => (x.Type, x.Date)),
            second.Events.Select(x => (x.Type, x.Date)));
    }

    [Fact]
    public void Events_are_returned_in_date_order()
    {
        var dates = CompanyPlanningGenerator.Generate(2026).Events.Select(x => x.Date).ToList();
        Assert.Equal(dates.OrderBy(x => x), dates);
    }

    private static List<DateOnly> Ntns(int year) => Dates(CompanyPlanningGenerator.Generate(year), PlanningType.NT);

    private static List<DateOnly> Dates(PlanningGenerationResult result, PlanningType type) =>
        result.Events.Where(x => x.Type == type).Select(x => x.Date).OrderBy(x => x).ToList();
}
