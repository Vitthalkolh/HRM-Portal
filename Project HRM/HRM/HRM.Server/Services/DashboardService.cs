using HRM.Server.Data;
using HRM.Server.DTOs;
using HRM.Server.Entities;
using HRM.Server.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace HRM.Server.Services;

public interface IDashboardService
{
    Task<AdminDashboardDto> GetAdminAsync(CancellationToken ct = default);
    Task<EmployeeDashboardDto> GetEmployeeAsync(int employeeId, int userId, CancellationToken ct = default);
}

/// <summary>
/// Every figure on both dashboards is computed here from live data. Nothing is hard-coded, and
/// no trend percentages are produced, because the product stores no historical snapshots to
/// compare against.
/// </summary>
public sealed class DashboardService(HrmDbContext db, ICalendarService calendar, ILeaveService leave) : IDashboardService
{
    private const int UpcomingWindowDays = 30;

    public async Task<AdminDashboardDto> GetAdminAsync(CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var monthStart = new DateOnly(today.Year, today.Month, 1);
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);

        var totalEmployees = await db.Employees.CountAsync(ct);
        var activeEmployees = await db.Employees.CountAsync(x => x.User.IsActive, ct);

        var onLeaveToday = await db.LeaveRequests
            .CountAsync(x => x.Status == LeaveStatus.Approved && x.FromDate <= today && x.ToDate >= today, ct);

        var pendingRequests = await db.LeaveRequests.CountAsync(x => x.Status == LeaveStatus.Pending, ct);

        var approvedThisMonth = await db.LeaveRequests
            .CountAsync(x => x.Status == LeaveStatus.Approved
                             && x.ReviewedAtUtc != null
                             && x.ReviewedAtUtc >= monthStart.ToDateTime(TimeOnly.MinValue)
                             && x.ReviewedAtUtc <= monthEnd.ToDateTime(TimeOnly.MaxValue), ct);

        var pendingReimbursements = await db.ExpenseClaims.CountAsync(x => x.Status == ReviewStatus.Pending, ct);
        var pendingReferrals = await db.Referrals.CountAsync(x => x.Status == ReferralStatus.Submitted, ct);

        var upcoming = await calendar.GetEventsAsync(today, today.AddDays(UpcomingWindowDays), isAdmin: true, ct);
        var upcomingBirthdays = upcoming.Count(x => x.Type == "Birthday");
        var upcomingAnniversaries = upcoming.Count(x => x.Type == "WorkAnniversary");

        var recent = await db.LeaveRequests
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(8)
            .Select(LeaveService.Projection)
            .ToListAsync(ct);

        var usage = await db.LeaveRequests
            .Where(x => x.Status == LeaveStatus.Approved && x.FromDate >= new DateOnly(today.Year, 1, 1))
            .GroupBy(x => new { x.LeaveType.Code, x.LeaveType.Name })
            .Select(g => new LeaveTypeUsageDto(g.Key.Code, g.Key.Name, g.Sum(x => x.Days), g.Count()))
            .ToListAsync(ct);

        return new AdminDashboardDto(
            totalEmployees, activeEmployees, onLeaveToday, pendingRequests, approvedThisMonth,
            pendingReimbursements, pendingReferrals, upcomingBirthdays, upcomingAnniversaries,
            recent, usage.OrderBy(x => x.Code).ToList());
    }

    public async Task<EmployeeDashboardDto> GetEmployeeAsync(int employeeId, int userId, CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var employee = await db.Employees
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == employeeId, ct)
            ?? throw AppException.NotFound("Your employee record could not be found.");

        var holidays = (await db.NationalHolidays
                .Where(x => x.Date >= employee.JoiningDate && x.Date <= today)
                .Select(x => x.Date)
                .ToListAsync(ct))
            .ToHashSet();

        var balances = await leave.GetBalancesAsync(employeeId, today.Year, ct);

        var recent = await db.LeaveRequests
            .AsNoTracking()
            .Where(x => x.EmployeeId == employeeId)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(5)
            .Select(LeaveService.Projection)
            .ToListAsync(ct);

        var upcoming = (await calendar.GetEventsAsync(today, today.AddDays(UpcomingWindowDays), isAdmin: false, ct))
            .Where(x => x.Type is "Birthday" or "WorkAnniversary" or "NationalHoliday" or "ManagementLeave")
            .Take(10)
            .ToList();

        var planning = await db.PlanningEvents
            .AsNoTracking()
            .Where(x => x.EndDate >= today)
            .OrderBy(x => x.StartDate)
            .Take(5)
            .Select(x => new PlanningEventDto(
                x.Id, x.Title, x.Type.ToString(), PlanningTypeNames.Describe(x.Type),
                x.StartDate, x.EndDate, x.Description, x.Location, x.Notes, x.IsGenerated, x.IsOverridden))
            .ToListAsync(ct);

        var unread = await db.Notifications.CountAsync(x => x.UserId == userId && !x.IsRead, ct);

        return new EmployeeDashboardDto(
            employee.FullName,
            employee.ProfileImagePath is null ? null : $"/api/employees/{employee.Id}/profile-image",
            WorkingDaysCalculator.Duration(employee.JoiningDate, today, holidays),
            balances,
            recent,
            upcoming,
            planning,
            unread);
    }
}

public static class PlanningTypeNames
{
    public static string Describe(PlanningType type) => type switch
    {
        PlanningType.NT => "NTNS Release",
        PlanningType.IT => "Dry Run",
        PlanningType.SNU => "SNU Release",
        PlanningType.E => "Company Event",
        _ => type.ToString(),
    };
}
