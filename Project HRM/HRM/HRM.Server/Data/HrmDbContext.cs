using HRM.Server.Entities;
using Microsoft.EntityFrameworkCore;

namespace HRM.Server.Data;

public sealed class HrmDbContext(DbContextOptions<HrmDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<LeaveType> LeaveTypes => Set<LeaveType>();
    public DbSet<LeaveBalance> LeaveBalances => Set<LeaveBalance>();
    public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();
    public DbSet<NationalHoliday> NationalHolidays => Set<NationalHoliday>();
    public DbSet<ManagementLeave> ManagementLeaves => Set<ManagementLeave>();
    public DbSet<CompanyPlanningEvent> PlanningEvents => Set<CompanyPlanningEvent>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<StoredFile> StoredFiles => Set<StoredFile>();
    public DbSet<ExpenseClaim> ExpenseClaims => Set<ExpenseClaim>();
    public DbSet<ReferralApplication> Referrals => Set<ReferralApplication>();
    public DbSet<SalarySlip> SalarySlips => Set<SalarySlip>();
    public DbSet<BirthdayEmailLog> BirthdayEmailLogs => Set<BirthdayEmailLog>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        // Every string defaults to nvarchar(max) otherwise, which SQL Server cannot index.
        foreach (var property in b.Model.GetEntityTypes()
                     .SelectMany(t => t.GetProperties())
                     .Where(p => p.ClrType == typeof(string) && p.GetMaxLength() is null))
        {
            property.SetMaxLength(400);
        }

        b.Entity<User>(e =>
        {
            e.HasIndex(x => x.Email).IsUnique();
            e.HasIndex(x => x.UserName).IsUnique();
            e.Property(x => x.Email).HasMaxLength(256);
            e.Property(x => x.UserName).HasMaxLength(64);
            e.Property(x => x.PasswordHash).HasMaxLength(512);
            e.Property(x => x.Role).HasConversion<string>().HasMaxLength(20);
        });

        b.Entity<Employee>(e =>
        {
            e.HasIndex(x => x.EmployeeCode).IsUnique();
            e.HasIndex(x => x.DateOfBirth);
            e.HasIndex(x => x.JoiningDate);
            e.Property(x => x.EmployeeCode).HasMaxLength(32);
            e.Property(x => x.FirstName).HasMaxLength(80);
            e.Property(x => x.LastName).HasMaxLength(80);
            e.Property(x => x.Phone).HasMaxLength(32);
            e.Property(x => x.EmploymentStatus).HasConversion<string>().HasMaxLength(20);
            e.Ignore(x => x.FullName);
            e.HasOne(x => x.User).WithOne(x => x.Employee)
                .HasForeignKey<Employee>(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne<Employee>().WithMany()
                .HasForeignKey(x => x.ManagerId)
                .OnDelete(DeleteBehavior.NoAction);
        });

        b.Entity<RefreshToken>(e =>
        {
            e.HasIndex(x => x.TokenHash).IsUnique();
            e.Property(x => x.TokenHash).HasMaxLength(64);
            e.Property(x => x.ReplacedByTokenHash).HasMaxLength(64);
            e.HasOne(x => x.User).WithMany(x => x.RefreshTokens)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<PasswordResetToken>(e =>
        {
            e.HasIndex(x => x.TokenHash);
            e.Property(x => x.TokenHash).HasMaxLength(64);
            e.HasOne<User>().WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<LeaveType>(e =>
        {
            e.HasIndex(x => x.Code).IsUnique();
            e.Property(x => x.Code).HasMaxLength(10);
            e.Property(x => x.Name).HasMaxLength(60);
            e.Property(x => x.AnnualQuota).HasPrecision(8, 2);
        });

        b.Entity<LeaveBalance>(e =>
        {
            e.HasIndex(x => new { x.EmployeeId, x.LeaveTypeId, x.Year }).IsUnique();
            e.Property(x => x.Total).HasPrecision(8, 2);
            e.Property(x => x.Taken).HasPrecision(8, 2);
            if (Database.IsSqlServer()) e.Property(x => x.RowVersion).IsRowVersion();
            e.HasOne(x => x.Employee).WithMany()
                .HasForeignKey(x => x.EmployeeId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.LeaveType).WithMany()
                .HasForeignKey(x => x.LeaveTypeId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<LeaveRequest>(e =>
        {
            e.HasIndex(x => new { x.EmployeeId, x.Status });
            e.HasIndex(x => new { x.FromDate, x.ToDate });
            e.HasIndex(x => x.Status);
            e.Property(x => x.Days).HasPrecision(8, 2);
            e.Property(x => x.Reason).HasMaxLength(500);
            e.Property(x => x.ReviewComment).HasMaxLength(500);
            e.Property(x => x.HalfDaySession).HasMaxLength(20);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            if (Database.IsSqlServer()) e.Property(x => x.RowVersion).IsRowVersion();
            // Leave history is a record that must survive employee deactivation.
            e.HasOne(x => x.Employee).WithMany()
                .HasForeignKey(x => x.EmployeeId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.LeaveType).WithMany()
                .HasForeignKey(x => x.LeaveTypeId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.ReviewedByUser).WithMany()
                .HasForeignKey(x => x.ReviewedByUserId)
                .OnDelete(DeleteBehavior.NoAction);
        });

        b.Entity<NationalHoliday>(e =>
        {
            e.HasIndex(x => x.Date).IsUnique();
            e.Property(x => x.Name).HasMaxLength(150);
        });

        b.Entity<ManagementLeave>(e =>
        {
            e.HasIndex(x => x.Date);
            e.Property(x => x.Title).HasMaxLength(150);
        });

        b.Entity<CompanyPlanningEvent>(e =>
        {
            e.HasIndex(x => new { x.StartDate, x.EndDate });
            e.HasIndex(x => new { x.Type, x.StartDate });
            e.Property(x => x.Title).HasMaxLength(150);
            e.Property(x => x.Type).HasConversion<string>().HasMaxLength(10);
        });

        b.Entity<Notification>(e =>
        {
            e.HasIndex(x => new { x.UserId, x.IsRead });
            e.HasIndex(x => x.CreatedAtUtc);
            e.Property(x => x.Title).HasMaxLength(150);
            e.Property(x => x.Body).HasMaxLength(500);
            e.Property(x => x.Type).HasMaxLength(40);
            e.HasOne(x => x.User).WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<AuditLog>(e =>
        {
            e.HasIndex(x => new { x.UserId, x.CreatedAtUtc });
            e.HasIndex(x => new { x.Module, x.CreatedAtUtc });
            e.Property(x => x.Action).HasMaxLength(60);
            e.Property(x => x.Module).HasMaxLength(60);
            e.Property(x => x.EntityId).HasMaxLength(60);
            e.Property(x => x.Details).HasMaxLength(2000);
            e.Property(x => x.IpAddress).HasMaxLength(64);
            // Audit rows outlive the user they describe.
            e.HasOne<User>().WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<StoredFile>(e =>
        {
            e.HasIndex(x => new { x.OwnerEmployeeId, x.Category });
            e.Property(x => x.Category).HasMaxLength(40);
            e.Property(x => x.OriginalFileName).HasMaxLength(260);
            e.Property(x => x.StoredFileName).HasMaxLength(80);
            e.Property(x => x.ContentType).HasMaxLength(120);
            e.Property(x => x.StoragePath).HasMaxLength(400);
        });

        b.Entity<ExpenseClaim>(e =>
        {
            e.HasIndex(x => new { x.EmployeeId, x.Status });
            e.Property(x => x.Amount).HasPrecision(12, 2);
            e.Property(x => x.ExpenseType).HasMaxLength(60);
            e.Property(x => x.Description).HasMaxLength(1000);
            e.Property(x => x.AdminNotes).HasMaxLength(1000);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.HasOne(x => x.Employee).WithMany()
                .HasForeignKey(x => x.EmployeeId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<ReferralApplication>(e =>
        {
            e.HasIndex(x => new { x.EmployeeId, x.Status });
            e.Property(x => x.CandidateName).HasMaxLength(120);
            e.Property(x => x.CandidateEmail).HasMaxLength(256);
            e.Property(x => x.Position).HasMaxLength(120);
            e.Property(x => x.Notes).HasMaxLength(1000);
            e.Property(x => x.InternalNotes).HasMaxLength(1000);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.HasOne(x => x.Employee).WithMany()
                .HasForeignKey(x => x.EmployeeId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<SalarySlip>(e =>
        {
            e.HasIndex(x => new { x.EmployeeId, x.Year, x.Month }).IsUnique();
            e.HasOne(x => x.Employee).WithMany()
                .HasForeignKey(x => x.EmployeeId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<BirthdayEmailLog>(e =>
        {
            e.HasIndex(x => new { x.EmployeeId, x.SentForDate }).IsUnique();
        });
    }
}
