namespace HRM.Server.Entities;

public enum RoleName { Admin, Employee }

/// <summary>Employee leave request lifecycle.</summary>
public enum LeaveStatus { Pending, Approved, Rejected, Cancelled, Withdrawn }

/// <summary>Company planning event types. NT = NTNS release, IT = dry run, SNU = SNU release, E = company event.</summary>
public enum PlanningType { NT, IT, SNU, E }

public enum ReviewStatus { Pending, Approved, Rejected }

public enum ReferralStatus { Submitted, Screening, Interviewing, Hired, Rejected }

public enum EmploymentStatus { Active, NoticePeriod, Resigned }

public abstract class AuditedEntity
{
    public int Id { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }
}

public sealed class User : AuditedEntity
{
    public string UserName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public RoleName Role { get; set; } = RoleName.Employee;
    public bool IsActive { get; set; } = true;

    /// <summary>Set when an administrator issues a temporary password; surfaced as a prompt, never as a forced redirect.</summary>
    public bool MustChangePassword { get; set; }

    public int FailedLoginCount { get; set; }
    public DateTime? LockedOutUntilUtc { get; set; }
    public DateTime? LastLoginAtUtc { get; set; }

    public Employee? Employee { get; set; }
    public List<RefreshToken> RefreshTokens { get; set; } = [];
}

public sealed class Employee : AuditedEntity
{
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string EmployeeCode { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Department { get; set; }
    public string? Designation { get; set; }
    public string? Location { get; set; }
    public DateOnly JoiningDate { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    public string? ProfileImagePath { get; set; }
    public int? ManagerId { get; set; }

    public EmploymentStatus EmploymentStatus { get; set; } = EmploymentStatus.Active;
    public DateOnly? ResignationDate { get; set; }
    public DateOnly? LastWorkingDate { get; set; }

    public string FullName => $"{FirstName} {LastName}".Trim();
}

public sealed class RefreshToken : AuditedEntity
{
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime? RevokedAtUtc { get; set; }
    public string? ReplacedByTokenHash { get; set; }
    public bool IsActive => RevokedAtUtc is null && ExpiresAtUtc > DateTime.UtcNow;
}

public sealed class PasswordResetToken : AuditedEntity
{
    public int UserId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime? UsedAtUtc { get; set; }
}

/// <summary>
/// Employee-applicable leave types only: EL, SL, CL, FL, WFH.
/// Management Leave and National Holiday are company calendar events and are deliberately NOT modelled here.
/// </summary>
public sealed class LeaveType : AuditedEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal AnnualQuota { get; set; }
    public string Description { get; set; } = string.Empty;
    public bool AllowHalfDay { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; }
}

public sealed class LeaveBalance : AuditedEntity
{
    public int EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    public int LeaveTypeId { get; set; }
    public LeaveType LeaveType { get; set; } = null!;
    public int Year { get; set; }
    public decimal Total { get; set; }
    public decimal Taken { get; set; }

    /// <summary>Optimistic concurrency guard so two simultaneous approvals cannot corrupt the balance.</summary>
    public byte[]? RowVersion { get; set; }
}

public sealed class LeaveRequest : AuditedEntity
{
    public int EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    public int LeaveTypeId { get; set; }
    public LeaveType LeaveType { get; set; } = null!;
    public DateOnly FromDate { get; set; }
    public DateOnly ToDate { get; set; }
    public bool IsHalfDay { get; set; }
    public string? HalfDaySession { get; set; }
    public decimal Days { get; set; }
    public string Reason { get; set; } = string.Empty;
    public LeaveStatus Status { get; set; } = LeaveStatus.Pending;
    public int? ReviewedByUserId { get; set; }
    public User? ReviewedByUser { get; set; }
    public DateTime? ReviewedAtUtc { get; set; }
    public string? ReviewComment { get; set; }

    public byte[]? RowVersion { get; set; }
}

/// <summary>Company-wide calendar event. Never deducted from any employee leave balance.</summary>
public sealed class NationalHoliday : AuditedEntity
{
    public string Name { get; set; } = string.Empty;
    public DateOnly Date { get; set; }
    public string? Description { get; set; }
}

/// <summary>Company-wide calendar event. Never deducted from any employee leave balance.</summary>
public sealed class ManagementLeave : AuditedEntity
{
    public string Title { get; set; } = string.Empty;
    public DateOnly Date { get; set; }
    public string? Description { get; set; }
}

public sealed class CompanyPlanningEvent : AuditedEntity
{
    public string Title { get; set; } = string.Empty;
    public PlanningType Type { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string? Description { get; set; }
    public string? Location { get; set; }
    public string? Notes { get; set; }

    /// <summary>True when the row came from the release-schedule generator rather than manual admin entry.</summary>
    public bool IsGenerated { get; set; }

    /// <summary>Set when an admin edits a generated row, so regeneration does not overwrite the override.</summary>
    public bool IsOverridden { get; set; }
}

public sealed class Notification : AuditedEntity
{
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string Type { get; set; } = "Info";
    public bool IsRead { get; set; }
    public string? Link { get; set; }
}

public sealed class AuditLog : AuditedEntity
{
    public int? UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string Module { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string? Details { get; set; }
    public string? IpAddress { get; set; }
}

public sealed class StoredFile : AuditedEntity
{
    public int UploadedByUserId { get; set; }

    /// <summary>Employee the file belongs to; download authorization is checked against this.</summary>
    public int OwnerEmployeeId { get; set; }
    public string Category { get; set; } = string.Empty;
    public string OriginalFileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long Size { get; set; }
    public string StoragePath { get; set; } = string.Empty;
}

public sealed class ExpenseClaim : AuditedEntity
{
    public int EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    public string ExpenseType { get; set; } = string.Empty;
    public DateOnly ExpenseDate { get; set; }
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;
    public string? ReferenceUrl { get; set; }
    public ReviewStatus Status { get; set; } = ReviewStatus.Pending;
    public int? AttachmentFileId { get; set; }
    public string? AdminNotes { get; set; }
    public int? ReviewedByUserId { get; set; }
    public DateTime? ReviewedAtUtc { get; set; }
}

public sealed class ReferralApplication : AuditedEntity
{
    public int EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    public string CandidateName { get; set; } = string.Empty;
    public string CandidateEmail { get; set; } = string.Empty;
    public string? CandidatePhone { get; set; }
    public string Position { get; set; } = string.Empty;
    public string? LinkedInUrl { get; set; }
    public string? Notes { get; set; }
    public int? ResumeFileId { get; set; }
    public ReferralStatus Status { get; set; } = ReferralStatus.Submitted;

    /// <summary>Admin-only. Never returned to the referring employee.</summary>
    public string? InternalNotes { get; set; }
    public int? ReviewedByUserId { get; set; }
    public DateTime? ReviewedAtUtc { get; set; }
}

public sealed class SalarySlip : AuditedEntity
{
    public int EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    public int Year { get; set; }
    public int Month { get; set; }
    public int FileId { get; set; }
    public int UploadedByUserId { get; set; }
}

/// <summary>
/// Idempotency ledger for the birthday mailer: one row per employee per date.
/// A unique index makes a duplicate send impossible even across restarts or concurrent instances.
/// </summary>
public sealed class BirthdayEmailLog : AuditedEntity
{
    public int EmployeeId { get; set; }
    public DateOnly SentForDate { get; set; }
    public DateTime SentAtUtc { get; set; } = DateTime.UtcNow;
    public int RecipientCount { get; set; }
}
