using HRM.Server.Entities;

namespace HRM.Server.Services;

public sealed record GeneratedPlanningEvent(PlanningType Type, string Title, DateOnly Date, string Description);

public sealed record PlanningGenerationResult(
    IReadOnlyList<GeneratedPlanningEvent> Events,
    IReadOnlyList<string> CancelledSnu);

/// <summary>
/// Yearly release schedule generator. Pure and deterministic, so the rules live in exactly one
/// place and are unit-testable; nothing about the schedule is hard-coded in the client.
///
/// Rules implemented:
///   NTNS (NT)  - 4 per year, roughly every 3 months, always on a Sunday.
///   Dry Run (IT) - exactly one week before each NTNS release.
///   SNU        - fortnightly on a Wednesday. The requirement says "one Wednesday release per
///                15 days"; since the release must fall on a Wednesday, the achievable cadence
///                is every 14 days. An occurrence within <c>snuCancellationWindowDays</c> of an
///                NTNS release is cancelled.
/// </summary>
public static class CompanyPlanningGenerator
{
    public const int NtnsReleasesPerYear = 4;
    public const int MonthsBetweenNtns = 3;
    public const int DryRunDaysBeforeNtns = 7;
    public const int SnuIntervalDays = 14;

    /// <summary>
    /// Builds the schedule for <paramref name="year"/>.
    /// </summary>
    /// <param name="firstNtns">
    /// Optional anchor for the first NTNS release. When omitted, the first Sunday on or after
    /// 8 January is used. The value is snapped forward to the next Sunday if it is not already one.
    /// </param>
    /// <param name="snuCancellationWindowDays">
    /// An SNU release this many days or fewer from an NTNS release is cancelled.
    /// </param>
    public static PlanningGenerationResult Generate(int year, DateOnly? firstNtns = null, int snuCancellationWindowDays = 7)
    {
        var anchor = SnapToSunday(firstNtns ?? FirstSundayOf(year));
        var events = new List<GeneratedPlanningEvent>();
        var cancelled = new List<string>();

        var ntnsDates = new List<DateOnly>();
        for (var i = 0; i < NtnsReleasesPerYear; i++)
        {
            var date = SnapToSunday(anchor.AddMonths(i * MonthsBetweenNtns));
            ntnsDates.Add(date);

            events.Add(new GeneratedPlanningEvent(
                PlanningType.NT,
                $"NTNS Release {i + 1}",
                date,
                $"Quarterly NTNS production release ({i + 1} of {NtnsReleasesPerYear})."));

            events.Add(new GeneratedPlanningEvent(
                PlanningType.IT,
                $"Dry Run for NTNS Release {i + 1}",
                date.AddDays(-DryRunDaysBeforeNtns),
                $"Dry run one week before the NTNS release on {date:dd MMM yyyy}."));
        }

        var occurrence = 0;
        var firstWednesday = NextOrSameWednesday(new DateOnly(year, 1, 1));
        for (var releaseDate = firstWednesday; releaseDate.Year == year; releaseDate = releaseDate.AddDays(SnuIntervalDays))
        {
            occurrence++;
            var clash = ntnsDates.FirstOrDefault(n => Math.Abs(n.DayNumber - releaseDate.DayNumber) <= snuCancellationWindowDays);
            if (clash != default)
            {
                cancelled.Add($"SNU on {releaseDate:dd MMM yyyy} cancelled - within {snuCancellationWindowDays} days of the NTNS release on {clash:dd MMM yyyy}.");
                continue;
            }

            events.Add(new GeneratedPlanningEvent(
                PlanningType.SNU,
                $"SNU Release {occurrence}",
                releaseDate,
                "Fortnightly SNU release (Wednesday)."));
        }

        return new PlanningGenerationResult(
            events.OrderBy(x => x.Date).ThenBy(x => x.Type).ToList(),
            cancelled);
    }

    /// <summary>
    /// The default first NTNS anchor. It starts on the second Sunday of the year rather than the
    /// first, so that the dry run one week earlier still falls inside the same year and all four
    /// NTNS releases keep their dry run.
    /// </summary>
    private static DateOnly FirstSundayOf(int year) => NextOrSameSunday(new DateOnly(year, 1, 8));

    private static DateOnly SnapToSunday(DateOnly date) => NextOrSameSunday(date);

    private static DateOnly NextOrSameSunday(DateOnly date) =>
        date.AddDays((7 - (int)date.DayOfWeek) % 7);

    private static DateOnly NextOrSameWednesday(DateOnly date) =>
        date.AddDays((((int)DayOfWeek.Wednesday - (int)date.DayOfWeek) + 7) % 7);
}
