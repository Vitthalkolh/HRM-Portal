using HRM.Server.Entities;
using HRM.Server.Infrastructure;
using HRM.Server.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace HRM.Server.Data;

public static class DatabaseInitializer
{
    /// <summary>
    /// The five employee leave types and their fixed quotas. Management Leave and National Holiday
    /// are deliberately absent: they are company calendar events, not leave types.
    /// </summary>
    private static readonly (string Code, string Name, decimal Quota, string Description, bool HalfDay, int Order)[] LeaveTypeSeed =
    [
        ("EL",  "Earned Leave",    15m, "Earned leave accrued for the year.",           true,  1),
        ("SL",  "Sick Leave",       6m, "Leave for illness or medical appointments.",   true,  2),
        ("CL",  "Casual Leave",     6m, "Short-notice personal leave.",                 true,  3),
        ("FL",  "Floater Leave",    3m, "Flexible leave for festivals of your choice.", false, 4),
        ("WFH", "Work From Home",  40m, "Approved days worked from home.",              true,  5),
    ];

    public static async Task InitializeAsync(IServiceProvider services, IWebHostEnvironment environment)
    {
        var db = services.GetRequiredService<HrmDbContext>();
        var config = services.GetRequiredService<IConfiguration>();
        var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger("DatabaseInitializer");
        var options = services.GetRequiredService<IOptions<InitialAdminOptions>>().Value;

        await MigrateAsync(db, logger);
        await SeedLeaveTypesAsync(db, logger);
        await SeedInitialAdminAsync(db, options, config, logger);

        if (options.SeedDemoData)
        {
            await SeedDemoDataAsync(db, services, logger);
        }

        await BackfillLeaveBalancesAsync(db, services, logger);
    }

    private static async Task MigrateAsync(HrmDbContext db, ILogger logger)
    {
        // Migrations are authored for SQL Server, the product database. The SQLite option is a
        // local/CI convenience, so its schema is created directly from the model instead.
        if (!db.Database.IsSqlServer())
        {
            await db.Database.EnsureCreatedAsync();
            logger.LogInformation("Schema ensured for the {Provider} provider.", db.Database.ProviderName);
            return;
        }

        var pending = (await db.Database.GetPendingMigrationsAsync()).ToList();
        var applied = (await db.Database.GetAppliedMigrationsAsync()).ToList();

        if (applied.Count > 0 || pending.Count > 0)
        {
            // Applies only new migrations; it never drops or recreates an existing database.
            logger.LogInformation("Applying {Count} pending migration(s).", pending.Count);
            await db.Database.MigrateAsync();
            return;
        }

        logger.LogWarning(
            "No EF Core migrations were found; creating the schema directly. " +
            "Run 'dotnet ef migrations add InitialCreate' before deploying anywhere shared.");
        await db.Database.EnsureCreatedAsync();
    }

    private static async Task SeedLeaveTypesAsync(HrmDbContext db, ILogger logger)
    {
        var existing = await db.LeaveTypes.ToListAsync();
        var changed = false;

        foreach (var (code, name, quota, description, halfDay, order) in LeaveTypeSeed)
        {
            var match = existing.FirstOrDefault(x => x.Code == code);

            if (match is null)
            {
                db.LeaveTypes.Add(new LeaveType
                {
                    Code = code, Name = name, AnnualQuota = quota,
                    Description = description, AllowHalfDay = halfDay, DisplayOrder = order,
                });
                changed = true;
            }
            else if (match.AnnualQuota != quota || match.Name != name || !match.IsActive || match.DisplayOrder != order)
            {
                // The quotas are a business rule, so drift is corrected on every start.
                match.AnnualQuota = quota;
                match.Name = name;
                match.Description = description;
                match.AllowHalfDay = halfDay;
                match.DisplayOrder = order;
                match.IsActive = true;
                match.UpdatedAtUtc = DateTime.UtcNow;
                changed = true;
            }
        }

        // Anything outside the five required types is retired rather than deleted, so historical
        // leave records that reference it remain readable.
        var codes = LeaveTypeSeed.Select(x => x.Code).ToHashSet();
        foreach (var extra in existing.Where(x => !codes.Contains(x.Code) && x.IsActive))
        {
            logger.LogWarning("Deactivating unexpected leave type '{Code}'; historical records are preserved.", extra.Code);
            extra.IsActive = false;
            extra.UpdatedAtUtc = DateTime.UtcNow;
            changed = true;
        }

        if (changed)
        {
            await db.SaveChangesAsync();
            logger.LogInformation("Leave types seeded: EL 15, SL 6, CL 6, FL 3, WFH 40.");
        }
    }

    private static async Task SeedInitialAdminAsync(
        HrmDbContext db, InitialAdminOptions options, IConfiguration config, ILogger logger)
    {
        if (await db.Users.AnyAsync()) return;

        var password = options.Password ?? config["InitialAdmin:Password"];

        if (string.IsNullOrWhiteSpace(password) || password.StartsWith("set-", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "No users exist yet and InitialAdmin:Password is not set. Configure it first with: " +
                "dotnet user-secrets set \"InitialAdmin:Password\" \"<a-strong-password>\"");
        }

        if (password.Length < 8)
            throw new InvalidOperationException("InitialAdmin:Password must be at least 8 characters.");

        var user = new User
        {
            UserName = options.UserName,
            Email = options.Email.ToLowerInvariant(),
            Role = RoleName.Admin,
        };

        user.PasswordHash = new PasswordHasher<User>().HashPassword(user, password);
        db.Users.Add(user);
        await db.SaveChangesAsync();

        db.Employees.Add(new Employee
        {
            UserId = user.Id,
            EmployeeCode = "HRM-ADMIN",
            FirstName = "System",
            LastName = "Administrator",
            Designation = "Administrator",
            Department = "Operations",
            JoiningDate = DateOnly.FromDateTime(DateTime.UtcNow),
        });

        await db.SaveChangesAsync();
        logger.LogInformation("Initial administrator '{UserName}' created.", user.UserName);
    }

    /// <summary>
    /// Ensures every employee has leave balance rows for the current year. Without this an
    /// employee cannot apply for leave at all.
    /// </summary>
    private static async Task BackfillLeaveBalancesAsync(HrmDbContext db, IServiceProvider services, ILogger logger)
    {
        var leave = services.GetRequiredService<ILeaveService>();
        var year = DateTime.UtcNow.Year;

        var employeeIds = await db.Employees.Select(x => x.Id).ToListAsync();
        foreach (var employeeId in employeeIds)
        {
            await leave.EnsureBalancesAsync(employeeId, year);
        }

        logger.LogInformation("Leave balances verified for {Count} employee(s) in {Year}.", employeeIds.Count, year);
    }

    /// <summary>
    /// Optional local evaluation data, enabled with InitialAdmin:SeedDemoData. It is never
    /// enabled by default and creates nothing if any employee other than the admin exists.
    /// </summary>
    private static async Task SeedDemoDataAsync(HrmDbContext db, IServiceProvider services, ILogger logger)
    {
        if (await db.Employees.CountAsync() > 1) return;

        var year = DateTime.UtcNow.Year;
        var hasher = new PasswordHasher<User>();
        const string demoPassword = "Demo@12345";

        var people = new[]
        {
            ("priya.sharma", "Priya", "Sharma", "Engineering", "Senior Engineer", new DateOnly(1993, 4, 12), new DateOnly(2021, 6, 1)),
            ("arjun.mehta", "Arjun", "Mehta", "Engineering", "Engineering Manager", new DateOnly(1988, 9, 3), new DateOnly(2019, 2, 18)),
            ("neha.iyer", "Neha", "Iyer", "People Operations", "HR Specialist", new DateOnly(1995, 1, 27), new DateOnly(2022, 11, 7)),
        };

        var index = 1;
        foreach (var (userName, first, last, department, designation, dob, joined) in people)
        {
            var user = new User { UserName = userName, Email = $"{userName}@hrm.local", Role = RoleName.Employee };
            user.PasswordHash = hasher.HashPassword(user, demoPassword);
            db.Users.Add(user);
            await db.SaveChangesAsync();

            db.Employees.Add(new Employee
            {
                UserId = user.Id,
                EmployeeCode = $"HRM-{index++:000}",
                FirstName = first,
                LastName = last,
                Department = department,
                Designation = designation,
                DateOfBirth = dob,
                JoiningDate = joined,
                Location = "Pune",
            });

            await db.SaveChangesAsync();
        }

        if (!await db.NationalHolidays.AnyAsync())
        {
            db.NationalHolidays.AddRange(
                new NationalHoliday { Name = "Republic Day", Date = new DateOnly(year, 1, 26), Description = "National holiday." },
                new NationalHoliday { Name = "Independence Day", Date = new DateOnly(year, 8, 15), Description = "National holiday." },
                new NationalHoliday { Name = "Gandhi Jayanti", Date = new DateOnly(year, 10, 2), Description = "National holiday." });
        }

        if (!await db.ManagementLeaves.AnyAsync())
        {
            db.ManagementLeaves.Add(new ManagementLeave
            {
                Title = "Annual leadership offsite",
                Date = new DateOnly(year, 11, 14),
                Description = "Management unavailable; approvals resume the next working day.",
            });
        }

        await db.SaveChangesAsync();

        if (!await db.PlanningEvents.AnyAsync())
        {
            var options = services.GetRequiredService<IOptions<AppOptions>>().Value;
            var generated = CompanyPlanningGenerator.Generate(year, null, options.SnuCancellationWindowDays);

            db.PlanningEvents.AddRange(generated.Events.Select(x => new CompanyPlanningEvent
            {
                Title = x.Title,
                Type = x.Type,
                StartDate = x.Date,
                EndDate = x.Date,
                Description = x.Description,
                IsGenerated = true,
            }));

            await db.SaveChangesAsync();
        }

        logger.LogInformation("Demo data seeded. Demo employee password: {Password}", demoPassword);
    }
}
