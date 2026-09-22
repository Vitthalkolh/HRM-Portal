using System.ComponentModel.DataAnnotations;

namespace HRM.Server.DTOs;

/// <summary>Uniform response envelope used by every endpoint, including error responses.</summary>
public record ApiResponse<T>(bool Success, string Message, T? Data = default, Dictionary<string, string[]>? Errors = null);

public record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount)
{
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}

// ---------------------------------------------------------------- authentication

public record LoginRequest([Required] string Login, [Required] string Password, bool RememberMe);
public record TokenResponse(string AccessToken, string RefreshToken, DateTime ExpiresAtUtc, UserDto User);
public record RefreshRequest([Required] string RefreshToken);
public record ForgotPasswordRequest([Required, EmailAddress] string Email);
public record ResetPasswordRequest([Required] string Token, [Required, MinLength(8)] string NewPassword, [Required] string ConfirmPassword);
public record ChangePasswordRequest([Required] string CurrentPassword, [Required, MinLength(8)] string NewPassword, [Required] string ConfirmPassword);

public record UserDto(
    int Id,
    string UserName,
    string Email,
    string Role,
    string FullName,
    int? EmployeeId,
    string? ProfileImageUrl,
    bool MustChangePassword);

// ---------------------------------------------------------------- employees & profile

public record EmployeeListItemDto(
    int Id,
    string EmployeeCode,
    string FullName,
    string Email,
    string? Department,
    string? Designation,
    DateOnly JoiningDate,
    string EmploymentStatus,
    bool IsActive,
    string Role,
    string? ProfileImageUrl);

public record EmployeeDetailDto(
    int Id,
    int UserId,
    string EmployeeCode,
    string FirstName,
    string LastName,
    string FullName,
    string Email,
    string UserName,
    string Role,
    string? Phone,
    string? Department,
    string? Designation,
    string? Location,
    DateOnly JoiningDate,
    DateOnly? DateOfBirth,
    string EmploymentStatus,
    DateOnly? ResignationDate,
    DateOnly? LastWorkingDate,
    string? ProfileImageUrl,
    bool IsActive,
    WorkingDurationDto WorkingDuration);

/// <summary>Employee-visible view of a colleague. Deliberately narrow.</summary>
public record EmployeeDirectoryDto(
    int Id,
    string EmployeeCode,
    string FullName,
    string? Department,
    string? Designation,
    string? ProfileImageUrl);

public record WorkingDurationDto(int Years, int Months, int Days, int TotalCalendarDays, int TotalWorkingDays);

public record CreateEmployeeRequest(
    [Required, MaxLength(80)] string FirstName,
    [Required, MaxLength(80)] string LastName,
    [Required, EmailAddress, MaxLength(256)] string Email,
    [Required, MaxLength(64)] string UserName,
    [Required, MinLength(8)] string TemporaryPassword,
    [Required, MaxLength(32)] string EmployeeCode,
    DateOnly JoiningDate,
    DateOnly? DateOfBirth,
    string? Phone,
    string? Department,
    string? Designation,
    string? Location,
    [Required] string Role);

/// <summary>Admin employee edit. Credentials are handled by the dedicated password endpoint.</summary>
public record UpdateEmployeeRequest(
    [Required, MaxLength(80)] string FirstName,
    [Required, MaxLength(80)] string LastName,
    [Required, EmailAddress, MaxLength(256)] string Email,
    string? Phone,
    string? Department,
    string? Designation,
    string? Location,
    DateOnly JoiningDate,
    DateOnly? DateOfBirth,
    [Required] string EmploymentStatus,
    DateOnly? ResignationDate,
    DateOnly? LastWorkingDate,
    bool IsActive,
    [Required] string Role);

/// <summary>Self-service profile edit: contact details only, never credentials or employment terms.</summary>
public record UpdateOwnProfileRequest(
    [Required, MaxLength(80)] string FirstName,
    [Required, MaxLength(80)] string LastName,
    [Phone, MaxLength(32)] string? Phone,
    [MaxLength(120)] string? Location,
    DateOnly? DateOfBirth);

public record AdminResetPasswordRequest([Required, MinLength(8)] string NewPassword, bool RequireChangeOnNextLogin = true);

// ---------------------------------------------------------------- leave

public record LeaveTypeDto(int Id, string Code, string Name, decimal AnnualQuota, string Description, bool AllowHalfDay);

public record LeaveBalanceDto(
    int LeaveTypeId,
    string Code,
    string Name,
    decimal Total,
    decimal Taken,
    decimal Pending,
    decimal Remaining,
    decimal Available);

public record LeaveRequestDto(
    int Id,
    int EmployeeId,
    string EmployeeName,
    string EmployeeCode,
    int LeaveTypeId,
    string LeaveTypeCode,
    string LeaveTypeName,
    DateOnly FromDate,
    DateOnly ToDate,
    bool IsHalfDay,
    string? HalfDaySession,
    decimal Days,
    string Reason,
    string Status,
    string? ReviewComment,
    string? ReviewedBy,
    DateTime? ReviewedAtUtc,
    DateTime AppliedAtUtc);

public record LeaveCreateRequest(
    [Range(1, int.MaxValue)] int LeaveTypeId,
    // DurationMode is "Single" or "Multiple" and drives which dates are required.
    [Required] string DurationMode,
    DateOnly FromDate,
    DateOnly? ToDate,
    bool IsHalfDay,
    string? HalfDaySession,
    [Required, MaxLength(500)] string Reason);

public record ReviewLeaveRequest([MaxLength(500)] string? Comment);

public record LeaveDaysPreviewRequest(DateOnly FromDate, DateOnly? ToDate, bool IsHalfDay);
public record LeaveDaysPreviewDto(decimal Days, IReadOnlyList<DateOnly> WorkingDates, IReadOnlyList<string> Excluded);

// ---------------------------------------------------------------- calendar & company events

public record HolidayRequest([Required, MaxLength(150)] string Name, DateOnly Date, [MaxLength(400)] string? Description);
public record NationalHolidayDto(int Id, string Name, DateOnly Date, string? Description);

public record ManagementLeaveRequest([Required, MaxLength(150)] string Title, DateOnly Date, [MaxLength(400)] string? Description);
public record ManagementLeaveDto(int Id, string Title, DateOnly Date, string? Description);

/// <summary>One entry on the single common calendar.</summary>
public record CalendarEventDto(
    string Id,
    string Type,
    string Title,
    DateOnly Start,
    DateOnly End,
    string? Description,
    int? EmployeeId,
    string? ProfileImageUrl);

public record PlanningEventRequest(
    [Required, MaxLength(150)] string Title,
    [Required] string Type,
    DateOnly StartDate,
    DateOnly EndDate,
    [MaxLength(400)] string? Description,
    [MaxLength(150)] string? Location,
    [MaxLength(400)] string? Notes);

public record PlanningEventDto(
    int Id,
    string Title,
    string Type,
    string TypeName,
    DateOnly StartDate,
    DateOnly EndDate,
    string? Description,
    string? Location,
    string? Notes,
    bool IsGenerated,
    bool IsOverridden);

public record GeneratePlanningRequest(int Year, DateOnly? FirstNtnsDate, bool Replace = false);
public record GeneratedPlanningPreviewDto(IReadOnlyList<PlanningEventDto> Events, IReadOnlyList<string> CancelledSnu);

// ---------------------------------------------------------------- dashboards & highlights

public record AdminDashboardDto(
    int TotalEmployees,
    int ActiveEmployees,
    int OnLeaveToday,
    int PendingLeaveRequests,
    int ApprovedThisMonth,
    int PendingReimbursements,
    int PendingReferrals,
    int UpcomingBirthdays,
    int UpcomingAnniversaries,
    IReadOnlyList<LeaveRequestDto> RecentRequests,
    IReadOnlyList<LeaveTypeUsageDto> LeaveUsageByType);

public record LeaveTypeUsageDto(string Code, string Name, decimal ApprovedDays, int RequestCount);

public record EmployeeDashboardDto(
    string FullName,
    string? ProfileImageUrl,
    WorkingDurationDto WorkingDuration,
    IReadOnlyList<LeaveBalanceDto> Balances,
    IReadOnlyList<LeaveRequestDto> RecentRequests,
    IReadOnlyList<CalendarEventDto> UpcomingEvents,
    IReadOnlyList<PlanningEventDto> UpcomingPlanning,
    int UnreadNotifications);

/// <summary>Backing data for the trending / monthly highlights popup.</summary>
public record HighlightDto(string Type, string Title, string Subtitle, DateOnly Date, string? ProfileImageUrl);
public record HighlightsDto(int Year, int Month, string MonthName, IReadOnlyList<HighlightDto> Items);

// ---------------------------------------------------------------- services

public record ExpenseClaimRequest(
    [Required, MaxLength(60)] string ExpenseType,
    DateOnly ExpenseDate,
    [Range(0.01, 9_999_999)] decimal Amount,
    [Required, MaxLength(1000)] string Description,
    [MaxLength(400), Url] string? ReferenceUrl);

public record ExpenseClaimDto(
    int Id,
    int EmployeeId,
    string EmployeeName,
    string ExpenseType,
    DateOnly ExpenseDate,
    decimal Amount,
    string Description,
    string? ReferenceUrl,
    string Status,
    int? AttachmentFileId,
    string? AdminNotes,
    DateTime CreatedAtUtc);

public record ReviewClaimRequest([Required] string Status, [MaxLength(1000)] string? AdminNotes);

public record ReferralRequest(
    [Required, MaxLength(120)] string CandidateName,
    [Required, EmailAddress, MaxLength(256)] string CandidateEmail,
    [Phone, MaxLength(32)] string? CandidatePhone,
    [Required, MaxLength(120)] string Position,
    [MaxLength(400), Url] string? LinkedInUrl,
    [MaxLength(1000)] string? Notes);

public record ReferralDto(
    int Id,
    int EmployeeId,
    string ReferredBy,
    string CandidateName,
    string CandidateEmail,
    string? CandidatePhone,
    string Position,
    string? LinkedInUrl,
    string? Notes,
    int? ResumeFileId,
    string Status,
    // InternalNotes is populated for administrators only.
    string? InternalNotes,
    DateTime CreatedAtUtc);

public record ReviewReferralRequest([Required] string Status, [MaxLength(1000)] string? InternalNotes);

public record SalarySlipDto(int Id, int EmployeeId, string EmployeeName, int Year, int Month, string MonthName, long SizeBytes, DateTime UploadedAtUtc);

// ---------------------------------------------------------------- notifications & audit

public record NotificationDto(int Id, string Title, string Body, string Type, bool IsRead, string? Link, DateTime CreatedAtUtc);
public record NotificationSummaryDto(int UnreadCount, IReadOnlyList<NotificationDto> Items);

public record AuditLogDto(int Id, int? UserId, string UserName, string Action, string Module, string EntityId, string? Details, string? IpAddress, DateTime CreatedAtUtc);
