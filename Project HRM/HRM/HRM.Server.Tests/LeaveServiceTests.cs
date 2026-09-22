using HRM.Server.Data;
using Microsoft.AspNetCore.Http;
using HRM.Server.DTOs;
using HRM.Server.Entities;
using HRM.Server.Infrastructure;
using HRM.Server.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace HRM.Server.Tests;

/// <summary>
/// Leave engine behaviour against a real (in-memory SQLite) database, so the arithmetic, the
/// status transitions and the balance movements are exercised through EF Core rather than mocked.
/// </summary>
public sealed class LeaveServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly HrmDbContext _db;
    private readonly LeaveService _leave;
    private readonly RecordingEmailService _email = new();

    private const int EmployeeId = 1;
    private const int AdminUserId = 99;
    private static readonly int Year = DateTime.UtcNow.Year;

    public LeaveServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        _db = new HrmDbContext(new DbContextOptionsBuilder<HrmDbContext>().UseSqlite(_connection).Options);
        _db.Database.EnsureCreated();

        Seed();

        _leave = new LeaveService(
            _db,
            new NoOpNotificationService(),
            _email,
            new NoOpAuditService(),
            Options.Create(new AppOptions()),
            NullLogger<LeaveService>.Instance);
    }

    private void Seed()
    {
        _db.LeaveTypes.AddRange(
            new LeaveType { Id = 1, Code = "EL", Name = "Earned Leave", AnnualQuota = 15, AllowHalfDay = true, DisplayOrder = 1 },
            new LeaveType { Id = 2, Code = "SL", Name = "Sick Leave", AnnualQuota = 6, AllowHalfDay = true, DisplayOrder = 2 },
            new LeaveType { Id = 3, Code = "CL", Name = "Casual Leave", AnnualQuota = 6, AllowHalfDay = true, DisplayOrder = 3 },
            new LeaveType { Id = 4, Code = "FL", Name = "Floater Leave", AnnualQuota = 3, AllowHalfDay = false, DisplayOrder = 4 },
            new LeaveType { Id = 5, Code = "WFH", Name = "Work From Home", AnnualQuota = 40, AllowHalfDay = true, DisplayOrder = 5 });

        var user = new User { Id = 10, UserName = "employee", Email = "employee@hrm.local", PasswordHash = "x" };
        var admin = new User { Id = AdminUserId, UserName = "admin", Email = "admin@hrm.local", PasswordHash = "x", Role = RoleName.Admin };
        _db.Users.AddRange(user, admin);

        _db.Employees.Add(new Employee
        {
            Id = EmployeeId, UserId = user.Id, EmployeeCode = "HRM-001",
            FirstName = "Test", LastName = "Employee", JoiningDate = new DateOnly(2022, 1, 3),
        });

        _db.SaveChanges();
    }

    /// <summary>A Monday-to-Friday window in the current year, safely clear of any seeded holiday.</summary>
    private static (DateOnly From, DateOnly To) WorkWeek(int weeksFromNow = 6)
    {
        var start = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(7 * weeksFromNow);
        while (start.DayOfWeek != DayOfWeek.Monday) start = start.AddDays(1);
        if (start.Year != Year) start = new DateOnly(Year, 6, 1).AddDays((8 - (int)new DateOnly(Year, 6, 1).DayOfWeek) % 7);
        return (start, start.AddDays(4));
    }

    private Task<LeaveRequestDto> ApplyAsync(int leaveTypeId, DateOnly from, DateOnly to, bool half = false, string? session = null) =>
        _leave.ApplyAsync(EmployeeId, new LeaveCreateRequest(
            leaveTypeId,
            from == to ? "Single" : "Multiple",
            from,
            from == to ? null : to,
            half,
            session,
            "Test reason"));

    private async Task<LeaveBalanceDto> BalanceAsync(string code) =>
        (await _leave.GetBalancesAsync(EmployeeId, Year)).Single(x => x.Code == code);

    // ---------------------------------------------------------------- allocation

    [Fact]
    public async Task Balances_are_allocated_with_the_required_quotas()
    {
        var balances = await _leave.GetBalancesAsync(EmployeeId, Year);

        Assert.Equal(5, balances.Count);
        Assert.Equal(15m, balances.Single(x => x.Code == "EL").Total);
        Assert.Equal(6m, balances.Single(x => x.Code == "SL").Total);
        Assert.Equal(6m, balances.Single(x => x.Code == "CL").Total);
        Assert.Equal(3m, balances.Single(x => x.Code == "FL").Total);
        Assert.Equal(40m, balances.Single(x => x.Code == "WFH").Total);
    }

    [Fact]
    public async Task Allocation_is_idempotent()
    {
        await _leave.EnsureBalancesAsync(EmployeeId, Year);
        await _leave.EnsureBalancesAsync(EmployeeId, Year);

        Assert.Equal(5, await _db.LeaveBalances.CountAsync(x => x.EmployeeId == EmployeeId && x.Year == Year));
    }

    // ---------------------------------------------------------------- applying

    [Fact]
    public async Task A_working_week_is_five_days_and_starts_as_pending()
    {
        var (from, to) = WorkWeek();
        var request = await ApplyAsync(1, from, to);

        Assert.Equal(5m, request.Days);
        Assert.Equal("Pending", request.Status);
    }

    [Fact]
    public async Task Pending_days_reduce_availability_but_not_the_taken_total()
    {
        var (from, to) = WorkWeek();
        await ApplyAsync(1, from, to);

        var balance = await BalanceAsync("EL");

        Assert.Equal(0m, balance.Taken);
        Assert.Equal(5m, balance.Pending);
        Assert.Equal(15m, balance.Remaining);  // display value: approved only
        Assert.Equal(10m, balance.Available);  // validation value: pending subtracted too
    }

    [Fact]
    public async Task Pending_requests_cannot_exceed_the_quota_in_aggregate()
    {
        var start = new DateOnly(Year, 2, 2);
        while (start.DayOfWeek != DayOfWeek.Monday) start = start.AddDays(1);

        // FL has a quota of 3; take 3 days, then a fourth must be refused.
        await ApplyAsync(4, start, start.AddDays(2));

        var error = await Assert.ThrowsAsync<AppException>(() => ApplyAsync(4, start.AddDays(7), start.AddDays(7)));

        Assert.Equal(StatusCodes.Status400BadRequest, error.StatusCode);
        Assert.Contains("Not enough FL", error.Message);
    }

    [Fact]
    public async Task Overlapping_requests_are_refused()
    {
        var (from, to) = WorkWeek();
        await ApplyAsync(1, from, to);

        var error = await Assert.ThrowsAsync<AppException>(() => ApplyAsync(3, from.AddDays(1), from.AddDays(1)));

        Assert.Equal(StatusCodes.Status409Conflict, error.StatusCode);
    }

    [Fact]
    public async Task A_weekend_only_request_is_refused()
    {
        var saturday = new DateOnly(Year, 3, 1);
        while (saturday.DayOfWeek != DayOfWeek.Saturday) saturday = saturday.AddDays(1);

        var error = await Assert.ThrowsAsync<AppException>(() => ApplyAsync(1, saturday, saturday.AddDays(1)));

        Assert.Contains("no working day", error.Message);
    }

    [Fact]
    public async Task National_holidays_are_not_deducted()
    {
        var (from, to) = WorkWeek(10);
        _db.NationalHolidays.Add(new NationalHoliday { Name = "Test holiday", Date = from.AddDays(2) });
        await _db.SaveChangesAsync();

        var request = await ApplyAsync(1, from, to);

        Assert.Equal(4m, request.Days);
    }

    [Fact]
    public async Task A_half_day_counts_as_half()
    {
        var (from, _) = WorkWeek();
        var request = await ApplyAsync(3, from, from, half: true, session: "First Half");

        Assert.Equal(0.5m, request.Days);
    }

    [Fact]
    public async Task A_half_day_cannot_span_multiple_dates()
    {
        var (from, to) = WorkWeek();

        var error = await Assert.ThrowsAsync<AppException>(() => ApplyAsync(3, from, to, half: true, session: "First Half"));

        Assert.Contains("single date", error.Message);
    }

    [Fact]
    public async Task A_half_day_needs_a_valid_session()
    {
        var (from, _) = WorkWeek();

        var error = await Assert.ThrowsAsync<AppException>(() => ApplyAsync(3, from, from, half: true, session: "Evening"));

        Assert.Contains("first half or the second half", error.Message);
    }

    [Fact]
    public async Task Leave_types_that_disallow_half_days_reject_them()
    {
        var (from, _) = WorkWeek();

        var error = await Assert.ThrowsAsync<AppException>(() => ApplyAsync(4, from, from, half: true, session: "First Half"));

        Assert.Contains("cannot be taken as a half day", error.Message);
    }

    [Fact]
    public async Task A_reason_is_mandatory()
    {
        var (from, _) = WorkWeek();

        var error = await Assert.ThrowsAsync<AppException>(() => _leave.ApplyAsync(EmployeeId,
            new LeaveCreateRequest(1, "Single", from, null, false, null, "   ")));

        Assert.Contains("reason is required", error.Message);
    }

    [Fact]
    public async Task A_multiple_day_request_without_an_end_date_is_refused()
    {
        var (from, _) = WorkWeek();

        var error = await Assert.ThrowsAsync<AppException>(() => _leave.ApplyAsync(EmployeeId,
            new LeaveCreateRequest(1, "Multiple", from, null, false, null, "Holiday")));

        Assert.Contains("end date", error.Message);
    }

    // ---------------------------------------------------------------- review workflow

    [Fact]
    public async Task Approval_deducts_the_balance_and_emails_everyone()
    {
        var (from, to) = WorkWeek();
        var request = await ApplyAsync(1, from, to);

        var approved = await _leave.ApproveAsync(request.Id, AdminUserId, "Approved");

        Assert.Equal("Approved", approved.Status);
        var balance = await BalanceAsync("EL");
        Assert.Equal(5m, balance.Taken);
        Assert.Equal(10m, balance.Remaining);
        Assert.Equal(0m, balance.Pending);

        var mail = Assert.Single(_email.Sent);
        Assert.Contains("Leave approved", mail.Subject);
        Assert.Equal(2, mail.To.Count); // every active user, including the employee
    }

    [Fact]
    public async Task Approving_twice_is_refused_and_deducts_only_once()
    {
        var (from, to) = WorkWeek();
        var request = await ApplyAsync(1, from, to);
        await _leave.ApproveAsync(request.Id, AdminUserId, null);

        var error = await Assert.ThrowsAsync<AppException>(() => _leave.ApproveAsync(request.Id, AdminUserId, null));

        Assert.Equal(StatusCodes.Status409Conflict, error.StatusCode);
        Assert.Equal(5m, (await BalanceAsync("EL")).Taken);
    }

    [Fact]
    public async Task Rejection_does_not_move_the_balance_and_sends_no_email()
    {
        var (from, to) = WorkWeek();
        var request = await ApplyAsync(2, from, to);

        var rejected = await _leave.RejectAsync(request.Id, AdminUserId, "Not this week");

        Assert.Equal("Rejected", rejected.Status);
        Assert.Equal(0m, (await BalanceAsync("SL")).Taken);
        Assert.Empty(_email.Sent);
    }

    [Fact]
    public async Task Cancelling_an_approved_leave_restores_the_balance()
    {
        var (from, to) = WorkWeek();
        var request = await ApplyAsync(1, from, to);
        await _leave.ApproveAsync(request.Id, AdminUserId, null);

        var cancelled = await _leave.CancelAsync(request.Id, AdminUserId, "Plans changed");

        Assert.Equal("Cancelled", cancelled.Status);
        Assert.Equal(0m, (await BalanceAsync("EL")).Taken);
    }

    [Fact]
    public async Task Only_an_approved_leave_can_be_cancelled()
    {
        var (from, to) = WorkWeek();
        var request = await ApplyAsync(1, from, to);

        var error = await Assert.ThrowsAsync<AppException>(() => _leave.CancelAsync(request.Id, AdminUserId, null));

        Assert.Contains("Only an approved leave", error.Message);
    }

    [Fact]
    public async Task An_employee_withdraws_only_their_own_pending_request()
    {
        var (from, to) = WorkWeek();
        var request = await ApplyAsync(1, from, to);

        var forbidden = await Assert.ThrowsAsync<AppException>(() => _leave.WithdrawAsync(request.Id, EmployeeId + 5));
        Assert.Equal(StatusCodes.Status403Forbidden, forbidden.StatusCode);

        var withdrawn = await _leave.WithdrawAsync(request.Id, EmployeeId);
        Assert.Equal("Withdrawn", withdrawn.Status);
        Assert.Equal(0m, (await BalanceAsync("EL")).Taken);
        Assert.Equal(0m, (await BalanceAsync("EL")).Pending);
    }

    [Fact]
    public async Task An_approved_request_cannot_be_withdrawn_by_the_employee()
    {
        var (from, to) = WorkWeek();
        var request = await ApplyAsync(1, from, to);
        await _leave.ApproveAsync(request.Id, AdminUserId, null);

        var error = await Assert.ThrowsAsync<AppException>(() => _leave.WithdrawAsync(request.Id, EmployeeId));

        Assert.Contains("read-only", error.Message);
    }

    [Fact]
    public async Task Withdrawn_days_are_released_for_reuse()
    {
        var start = new DateOnly(Year, 2, 2);
        while (start.DayOfWeek != DayOfWeek.Monday) start = start.AddDays(1);

        var first = await ApplyAsync(4, start, start.AddDays(2)); // all 3 FL days
        await _leave.WithdrawAsync(first.Id, EmployeeId);

        var second = await ApplyAsync(4, start.AddDays(7), start.AddDays(9));

        Assert.Equal(3m, second.Days);
    }

    // ---------------------------------------------------------------- listing

    [Fact]
    public async Task History_is_scoped_paged_and_filterable()
    {
        var (from, to) = WorkWeek();
        var request = await ApplyAsync(1, from, to);
        await _leave.RejectAsync(request.Id, AdminUserId, null);
        await ApplyAsync(3, from.AddDays(14), from.AddDays(14));

        var all = await _leave.GetRequestsAsync(EmployeeId, null, 1, 10);
        Assert.Equal(2, all.TotalCount);

        var rejected = await _leave.GetRequestsAsync(EmployeeId, "Rejected", 1, 10);
        Assert.Single(rejected.Items);

        var others = await _leave.GetRequestsAsync(EmployeeId + 5, null, 1, 10);
        Assert.Empty(others.Items);
    }

    [Fact]
    public async Task The_request_projection_never_exposes_the_user_entity()
    {
        var (from, to) = WorkWeek();
        await ApplyAsync(1, from, to);

        var page = await _leave.GetRequestsAsync(EmployeeId, null, 1, 10);
        var serialized = System.Text.Json.JsonSerializer.Serialize(page);

        Assert.DoesNotContain("passwordHash", serialized, StringComparison.OrdinalIgnoreCase);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    // ---------------------------------------------------------------- test doubles

    private sealed class RecordingEmailService : IEmailService
    {
        public List<EmailMessage> Sent { get; } = [];

        public Task<bool> SendAsync(EmailMessage message, CancellationToken ct = default)
        {
            Sent.Add(message);
            return Task.FromResult(true);
        }
    }

    private sealed class NoOpNotificationService : INotificationService
    {
        public Task NotifyAsync(int userId, string title, string body, string type, string? link = null, CancellationToken ct = default) => Task.CompletedTask;
        public Task NotifyAllAsync(string title, string body, string type, string? link = null, CancellationToken ct = default) => Task.CompletedTask;
    }

    private sealed class NoOpAuditService : IAuditService
    {
        public Task RecordAsync(string module, string action, string entityId, string? details = null, int? userId = null, string? userName = null, CancellationToken ct = default) => Task.CompletedTask;
    }
}
