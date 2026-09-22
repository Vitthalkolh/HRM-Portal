using System.Linq.Expressions;
using HRM.Server.Data;
using HRM.Server.DTOs;
using HRM.Server.Entities;
using HRM.Server.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace HRM.Server.Services;

public interface ILeaveService
{
    Task<IReadOnlyList<LeaveTypeDto>> GetTypesAsync(CancellationToken ct = default);
    Task<IReadOnlyList<LeaveBalanceDto>> GetBalancesAsync(int employeeId, int year, CancellationToken ct = default);
    Task<PagedResult<LeaveRequestDto>> GetRequestsAsync(int? employeeId, string? status, int page, int pageSize, CancellationToken ct = default);
    Task<LeaveDaysPreviewDto> PreviewAsync(LeaveDaysPreviewRequest request, CancellationToken ct = default);
    Task<LeaveRequestDto> ApplyAsync(int employeeId, LeaveCreateRequest request, CancellationToken ct = default);
    Task<LeaveRequestDto> ApproveAsync(int leaveId, int adminUserId, string? comment, CancellationToken ct = default);
    Task<LeaveRequestDto> RejectAsync(int leaveId, int adminUserId, string? comment, CancellationToken ct = default);
    Task<LeaveRequestDto> CancelAsync(int leaveId, int adminUserId, string? comment, CancellationToken ct = default);
    Task<LeaveRequestDto> WithdrawAsync(int leaveId, int employeeId, CancellationToken ct = default);

    /// <summary>Creates any missing balance rows for the employee/year from the active leave types.</summary>
    Task EnsureBalancesAsync(int employeeId, int year, CancellationToken ct = default);
}

public sealed class LeaveService(
    HrmDbContext db,
    INotificationService notifications,
    IEmailService email,
    IAuditService audit,
    IOptions<AppOptions> appOptions,
    ILogger<LeaveService> logger) : ILeaveService
{
    private readonly AppOptions _app = appOptions.Value;

    public async Task<IReadOnlyList<LeaveTypeDto>> GetTypesAsync(CancellationToken ct = default) =>
        await db.LeaveTypes
            .Where(x => x.IsActive)
            .OrderBy(x => x.DisplayOrder).ThenBy(x => x.Code)
            .Select(x => new LeaveTypeDto(x.Id, x.Code, x.Name, x.AnnualQuota, x.Description, x.AllowHalfDay))
            .ToListAsync(ct);

    public async Task EnsureBalancesAsync(int employeeId, int year, CancellationToken ct = default)
    {
        var types = await db.LeaveTypes.Where(x => x.IsActive).ToListAsync(ct);
        var existing = await db.LeaveBalances
            .Where(x => x.EmployeeId == employeeId && x.Year == year)
            .Select(x => x.LeaveTypeId)
            .ToListAsync(ct);

        var missing = types.Where(t => !existing.Contains(t.Id)).ToList();
        if (missing.Count == 0) return;

        db.LeaveBalances.AddRange(missing.Select(t => new LeaveBalance
        {
            EmployeeId = employeeId,
            LeaveTypeId = t.Id,
            Year = year,
            Total = t.AnnualQuota,
            Taken = 0,
        }));

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Allocated {Count} leave balance row(s) for employee {EmployeeId} in {Year}.", missing.Count, employeeId, year);
    }

    public async Task<IReadOnlyList<LeaveBalanceDto>> GetBalancesAsync(int employeeId, int year, CancellationToken ct = default)
    {
        await EnsureBalancesAsync(employeeId, year, ct);

        var balances = await db.LeaveBalances
            .Include(x => x.LeaveType)
            .Where(x => x.EmployeeId == employeeId && x.Year == year)
            .ToListAsync(ct);

        var pendingByType = await db.LeaveRequests
            .Where(x => x.EmployeeId == employeeId && x.Status == LeaveStatus.Pending && x.FromDate.Year == year)
            .GroupBy(x => x.LeaveTypeId)
            .Select(g => new { LeaveTypeId = g.Key, Days = g.Sum(x => x.Days) })
            .ToDictionaryAsync(x => x.LeaveTypeId, x => x.Days, ct);

        return balances
            .OrderBy(x => x.LeaveType.DisplayOrder).ThenBy(x => x.LeaveType.Code)
            .Select(x =>
            {
                var pending = pendingByType.GetValueOrDefault(x.LeaveTypeId);
                return new LeaveBalanceDto(
                    x.LeaveTypeId,
                    x.LeaveType.Code,
                    x.LeaveType.Name,
                    x.Total,
                    x.Taken,
                    pending,
                    // Displayed remaining excludes only approved/taken days...
                    x.Total - x.Taken,
                    // ...while availability for a new request also excludes pending days.
                    x.Total - x.Taken - pending);
            })
            .ToList();
    }

    public async Task<PagedResult<LeaveRequestDto>> GetRequestsAsync(
        int? employeeId, string? status, int page, int pageSize, CancellationToken ct = default)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.LeaveRequests.AsNoTracking();
        if (employeeId is not null) query = query.Where(x => x.EmployeeId == employeeId);

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<LeaveStatus>(status, true, out var parsed))
            query = query.Where(x => x.Status == parsed);

        var total = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(Projection)
            .ToListAsync(ct);

        return new PagedResult<LeaveRequestDto>(items, page, pageSize, total);
    }

    public async Task<LeaveDaysPreviewDto> PreviewAsync(LeaveDaysPreviewRequest request, CancellationToken ct = default)
    {
        var to = request.ToDate ?? request.FromDate;
        if (to < request.FromDate) throw AppException.BadRequest("The end date cannot be before the start date.");

        var holidays = await HolidaysBetweenAsync(request.FromDate, to, ct);
        var workingDates = WorkingDaysCalculator.WorkingDates(request.FromDate, to, holidays);

        var excluded = new List<string>();
        for (var day = request.FromDate; day <= to; day = day.AddDays(1))
        {
            if (day.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
                excluded.Add($"{day:dd MMM yyyy} - weekend");
            else if (holidays.Contains(day))
                excluded.Add($"{day:dd MMM yyyy} - national holiday");
        }

        var days = request.IsHalfDay ? (workingDates.Count > 0 ? 0.5m : 0m) : workingDates.Count;
        return new LeaveDaysPreviewDto(days, workingDates, excluded);
    }

    public async Task<LeaveRequestDto> ApplyAsync(int employeeId, LeaveCreateRequest request, CancellationToken ct = default)
    {
        var isSingleDay = string.Equals(request.DurationMode, "Single", StringComparison.OrdinalIgnoreCase);
        if (!isSingleDay && !string.Equals(request.DurationMode, "Multiple", StringComparison.OrdinalIgnoreCase))
            throw AppException.BadRequest("Choose either a single day or multiple days.");

        var from = request.FromDate;
        var to = isSingleDay ? from : request.ToDate ?? throw AppException.BadRequest("Select an end date for a multiple-day leave.");

        if (to < from) throw AppException.BadRequest("The end date cannot be before the start date.");
        if (string.IsNullOrWhiteSpace(request.Reason)) throw AppException.BadRequest("A reason is required.");

        var type = await db.LeaveTypes.FirstOrDefaultAsync(x => x.Id == request.LeaveTypeId && x.IsActive, ct)
            ?? throw AppException.BadRequest("Choose a valid leave type.");

        if (request.IsHalfDay)
        {
            if (!type.AllowHalfDay) throw AppException.BadRequest($"{type.Name} cannot be taken as a half day.");
            if (!isSingleDay || to != from) throw AppException.BadRequest("A half day must be a single date.");
            if (request.HalfDaySession is not ("First Half" or "Second Half"))
                throw AppException.BadRequest("Choose either the first half or the second half of the day.");
        }

        var holidays = await HolidaysBetweenAsync(from, to, ct);
        var workingDates = WorkingDaysCalculator.WorkingDates(from, to, holidays);
        if (workingDates.Count == 0)
            throw AppException.BadRequest("The selected dates contain no working day. Weekends and national holidays are not deducted.");

        var days = request.IsHalfDay ? 0.5m : workingDates.Count;

        var overlaps = await db.LeaveRequests.AnyAsync(x =>
            x.EmployeeId == employeeId &&
            (x.Status == LeaveStatus.Pending || x.Status == LeaveStatus.Approved) &&
            x.FromDate <= to && x.ToDate >= from, ct);

        if (overlaps) throw AppException.Conflict("You already have a pending or approved leave that overlaps these dates.");

        var year = from.Year;
        if (to.Year != year)
            throw AppException.BadRequest("A leave request cannot span two calendar years. Please submit one request per year.");

        await EnsureBalancesAsync(employeeId, year, ct);

        var balance = await db.LeaveBalances
            .FirstOrDefaultAsync(x => x.EmployeeId == employeeId && x.LeaveTypeId == type.Id && x.Year == year, ct)
            ?? throw AppException.BadRequest($"No {type.Code} balance is allocated for {year}.");

        var pending = await db.LeaveRequests
            .Where(x => x.EmployeeId == employeeId && x.LeaveTypeId == type.Id
                        && x.Status == LeaveStatus.Pending && x.FromDate.Year == year)
            .SumAsync(x => (decimal?)x.Days, ct) ?? 0m;

        // Availability deliberately subtracts pending days as well as taken days.
        var available = balance.Total - balance.Taken - pending;
        if (available < days)
            throw AppException.BadRequest(
                $"Not enough {type.Code} available. You requested {days:0.##} day(s) but only {available:0.##} remain " +
                $"({balance.Total:0.##} total, {balance.Taken:0.##} taken, {pending:0.##} pending).");

        var entity = new LeaveRequest
        {
            EmployeeId = employeeId,
            LeaveTypeId = type.Id,
            FromDate = from,
            ToDate = to,
            IsHalfDay = request.IsHalfDay,
            HalfDaySession = request.IsHalfDay ? request.HalfDaySession : null,
            Days = days,
            Reason = request.Reason.Trim(),
            Status = LeaveStatus.Pending,
        };

        db.LeaveRequests.Add(entity);
        await db.SaveChangesAsync(ct);

        await audit.RecordAsync("Leave", "Apply", entity.Id.ToString(),
            $"{type.Code} {from:yyyy-MM-dd}..{to:yyyy-MM-dd} ({days:0.##} day(s))", ct: ct);

        // Administrators are told in-app; per the requirements no email is sent on application.
        var adminIds = await db.Users.Where(x => x.Role == RoleName.Admin && x.IsActive).Select(x => x.Id).ToListAsync(ct);
        foreach (var adminId in adminIds)
        {
            await notifications.NotifyAsync(adminId, "Leave request awaiting review",
                $"{await EmployeeNameAsync(employeeId, ct)} requested {days:0.##} day(s) of {type.Code}.",
                "LeaveRequested", "/admin/leave-requests", ct);
        }

        return await GetDtoAsync(entity.Id, ct);
    }

    public async Task<LeaveRequestDto> ApproveAsync(int leaveId, int adminUserId, string? comment, CancellationToken ct = default)
    {
        var request = await LoadForReviewAsync(leaveId, ct);

        // Conflict rather than bad request: the caller's intent was valid, the row simply moved
        // on. A double-clicked Approve and a genuine race therefore report the same way.
        if (request.Status != LeaveStatus.Pending)
            throw AppException.Conflict($"This request is already {request.Status.ToString().ToLowerInvariant()}.");

        var year = request.FromDate.Year;
        await EnsureBalancesAsync(request.EmployeeId, year, ct);

        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        // Claim the request atomically: the update only matches while the row is still Pending, so a
        // second concurrent approval (or a double-click) affects zero rows and is rejected below.
        var claimed = await db.LeaveRequests
            .Where(x => x.Id == leaveId && x.Status == LeaveStatus.Pending)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.Status, LeaveStatus.Approved)
                .SetProperty(x => x.ReviewedByUserId, adminUserId)
                .SetProperty(x => x.ReviewedAtUtc, DateTime.UtcNow)
                .SetProperty(x => x.ReviewComment, comment)
                .SetProperty(x => x.UpdatedAtUtc, DateTime.UtcNow), ct);

        if (claimed == 0)
        {
            await transaction.RollbackAsync(ct);
            throw AppException.Conflict("This request was already reviewed by someone else.");
        }

        // Deduct only if the balance still covers it; the predicate makes the check and the
        // write a single atomic statement.
        var deducted = await db.LeaveBalances
            .Where(x => x.EmployeeId == request.EmployeeId
                        && x.LeaveTypeId == request.LeaveTypeId
                        && x.Year == year
                        && x.Total - x.Taken >= request.Days)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.Taken, x => x.Taken + request.Days)
                .SetProperty(x => x.UpdatedAtUtc, DateTime.UtcNow), ct);

        if (deducted == 0)
        {
            await transaction.RollbackAsync(ct);
            throw AppException.Conflict(
                $"The {request.LeaveType.Code} balance no longer covers {request.Days:0.##} day(s). The request was not approved.");
        }

        await transaction.CommitAsync(ct);
        db.ChangeTracker.Clear();

        var approverName = await db.Users.Where(x => x.Id == adminUserId).Select(x => x.UserName).FirstOrDefaultAsync(ct) ?? "Administrator";

        await audit.RecordAsync("Leave", "Approve", leaveId.ToString(),
            $"{request.LeaveType.Code} {request.Days:0.##} day(s) for employee {request.EmployeeId}", adminUserId, approverName, ct);

        await notifications.NotifyAsync(request.Employee.UserId, "Leave approved",
            $"Your {request.LeaveType.Code} leave from {request.FromDate:dd MMM} to {request.ToDate:dd MMM yyyy} was approved.",
            "LeaveApproved", "/employee/leave/history", ct);

        // The requirement is a company-wide email on approval only.
        await SendApprovalEmailAsync(request, approverName, ct);

        return await GetDtoAsync(leaveId, ct);
    }

    public async Task<LeaveRequestDto> RejectAsync(int leaveId, int adminUserId, string? comment, CancellationToken ct = default)
    {
        var request = await LoadForReviewAsync(leaveId, ct);
        if (request.Status != LeaveStatus.Pending)
            throw AppException.Conflict($"This request is already {request.Status.ToString().ToLowerInvariant()}.");

        var claimed = await db.LeaveRequests
            .Where(x => x.Id == leaveId && x.Status == LeaveStatus.Pending)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.Status, LeaveStatus.Rejected)
                .SetProperty(x => x.ReviewedByUserId, adminUserId)
                .SetProperty(x => x.ReviewedAtUtc, DateTime.UtcNow)
                .SetProperty(x => x.ReviewComment, comment)
                .SetProperty(x => x.UpdatedAtUtc, DateTime.UtcNow), ct);

        if (claimed == 0) throw AppException.Conflict("This request was already reviewed by someone else.");

        // No balance movement on rejection, by design.
        await audit.RecordAsync("Leave", "Reject", leaveId.ToString(), comment, adminUserId, ct: ct);
        await notifications.NotifyAsync(request.Employee.UserId, "Leave rejected",
            $"Your {request.LeaveType.Code} leave from {request.FromDate:dd MMM} to {request.ToDate:dd MMM yyyy} was not approved.",
            "LeaveRejected", "/employee/leave/history", ct);

        return await GetDtoAsync(leaveId, ct);
    }

    public async Task<LeaveRequestDto> CancelAsync(int leaveId, int adminUserId, string? comment, CancellationToken ct = default)
    {
        var request = await LoadForReviewAsync(leaveId, ct);
        if (request.Status != LeaveStatus.Approved)
            throw AppException.BadRequest("Only an approved leave can be cancelled.");

        var year = request.FromDate.Year;

        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        var claimed = await db.LeaveRequests
            .Where(x => x.Id == leaveId && x.Status == LeaveStatus.Approved)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.Status, LeaveStatus.Cancelled)
                .SetProperty(x => x.ReviewedByUserId, adminUserId)
                .SetProperty(x => x.ReviewedAtUtc, DateTime.UtcNow)
                .SetProperty(x => x.ReviewComment, comment)
                .SetProperty(x => x.UpdatedAtUtc, DateTime.UtcNow), ct);

        if (claimed == 0)
        {
            await transaction.RollbackAsync(ct);
            throw AppException.Conflict("This request was already changed by someone else.");
        }

        var restored = await db.LeaveBalances
            .Where(x => x.EmployeeId == request.EmployeeId && x.LeaveTypeId == request.LeaveTypeId && x.Year == year)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.Taken, x => x.Taken - request.Days)
                .SetProperty(x => x.UpdatedAtUtc, DateTime.UtcNow), ct);

        if (restored == 0)
        {
            await transaction.RollbackAsync(ct);
            throw AppException.Conflict("The leave balance for that year could not be found, so the cancellation was not applied.");
        }

        await transaction.CommitAsync(ct);
        db.ChangeTracker.Clear();

        await audit.RecordAsync("Leave", "Cancel", leaveId.ToString(),
            $"Restored {request.Days:0.##} {request.LeaveType.Code} day(s) to employee {request.EmployeeId}", adminUserId, ct: ct);

        await notifications.NotifyAsync(request.Employee.UserId, "Leave cancelled",
            $"Your approved {request.LeaveType.Code} leave from {request.FromDate:dd MMM} to {request.ToDate:dd MMM yyyy} was cancelled and the balance restored.",
            "LeaveCancelled", "/employee/leave/history", ct);

        return await GetDtoAsync(leaveId, ct);
    }

    public async Task<LeaveRequestDto> WithdrawAsync(int leaveId, int employeeId, CancellationToken ct = default)
    {
        var request = await db.LeaveRequests.FirstOrDefaultAsync(x => x.Id == leaveId, ct)
            ?? throw AppException.NotFound("That leave request no longer exists.");

        if (request.EmployeeId != employeeId)
            throw AppException.Forbidden("You can only withdraw your own leave request.");

        if (request.Status != LeaveStatus.Pending)
            throw AppException.BadRequest("Only a pending request can be withdrawn. Approved, rejected and cancelled records are read-only.");

        var claimed = await db.LeaveRequests
            .Where(x => x.Id == leaveId && x.Status == LeaveStatus.Pending)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.Status, LeaveStatus.Withdrawn)
                .SetProperty(x => x.UpdatedAtUtc, DateTime.UtcNow), ct);

        if (claimed == 0) throw AppException.Conflict("This request was reviewed before it could be withdrawn.");

        // Pending days were never deducted, so no balance movement is required.
        await audit.RecordAsync("Leave", "Withdraw", leaveId.ToString(), ct: ct);
        return await GetDtoAsync(leaveId, ct);
    }

    private async Task SendApprovalEmailAsync(LeaveRequest request, string approverName, CancellationToken ct)
    {
        var recipients = await db.Users
            .Where(x => x.IsActive && x.Email != null && x.Email != "")
            .Select(x => x.Email)
            .ToListAsync(ct);

        var (subject, body) = EmailTemplates.LeaveApproved(
            _app.CompanyName, request.Employee, request.LeaveType, request, approverName);

        await email.SendAsync(new EmailMessage(recipients, subject, body), ct);
    }

    private async Task<LeaveRequest> LoadForReviewAsync(int leaveId, CancellationToken ct) =>
        await db.LeaveRequests
            .AsNoTracking()
            .Include(x => x.Employee).ThenInclude(x => x.User)
            .Include(x => x.LeaveType)
            .FirstOrDefaultAsync(x => x.Id == leaveId, ct)
        ?? throw AppException.NotFound("That leave request no longer exists.");

    private async Task<string> EmployeeNameAsync(int employeeId, CancellationToken ct) =>
        await db.Employees.Where(x => x.Id == employeeId)
            .Select(x => x.FirstName + " " + x.LastName)
            .FirstOrDefaultAsync(ct) ?? "An employee";

    private async Task<IReadOnlySet<DateOnly>> HolidaysBetweenAsync(DateOnly from, DateOnly to, CancellationToken ct) =>
        (await db.NationalHolidays
            .Where(x => x.Date >= from && x.Date <= to)
            .Select(x => x.Date)
            .ToListAsync(ct))
        .ToHashSet();

    internal async Task<LeaveRequestDto> GetDtoAsync(int leaveId, CancellationToken ct) =>
        await db.LeaveRequests.AsNoTracking().Where(x => x.Id == leaveId).Select(Projection).FirstAsync(ct);

    /// <summary>
    /// The single projection every leave endpoint uses, so an entity graph (which would include
    /// the employee's User and its password hash) can never be serialized by accident.
    /// </summary>
    internal static readonly Expression<Func<LeaveRequest, LeaveRequestDto>> Projection = x => new LeaveRequestDto(
        x.Id,
        x.EmployeeId,
        x.Employee.FirstName + " " + x.Employee.LastName,
        x.Employee.EmployeeCode,
        x.LeaveTypeId,
        x.LeaveType.Code,
        x.LeaveType.Name,
        x.FromDate,
        x.ToDate,
        x.IsHalfDay,
        x.HalfDaySession,
        x.Days,
        x.Reason,
        x.Status.ToString(),
        x.ReviewComment,
        x.ReviewedByUser == null ? null : x.ReviewedByUser.UserName,
        x.ReviewedAtUtc,
        x.CreatedAtUtc);
}
