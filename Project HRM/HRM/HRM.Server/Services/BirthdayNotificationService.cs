using HRM.Server.Data;
using HRM.Server.Entities;
using HRM.Server.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace HRM.Server.Services;

/// <summary>
/// Sends the company-wide birthday email once per employee per day.
///
/// Idempotency does not rely on the process staying alive: a row is inserted into
/// BirthdayEmailLog, which carries a unique index on (EmployeeId, SentForDate). A restart,
/// a second instance or a repeated tick all collide on that index and skip the send.
/// </summary>
public sealed class BirthdayNotificationService(
    IServiceScopeFactory scopeFactory,
    IOptions<AppOptions> appOptions,
    ILogger<BirthdayNotificationService> logger) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromHours(1);
    private readonly AppOptions _app = appOptions.Value;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Give the host time to finish migrating and seeding before the first pass.
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunOnceAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "The birthday mailer pass failed; it will be retried on the next tick.");
            }

            try
            {
                await Task.Delay(PollInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    /// <summary>Exposed for tests and for the admin "run now" endpoint.</summary>
    public async Task<int> RunOnceAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HrmDbContext>();
        var email = scope.ServiceProvider.GetRequiredService<IEmailService>();
        var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var candidates = await db.Employees
            .Include(x => x.User)
            .Where(x => x.User.IsActive
                        && x.DateOfBirth != null
                        && x.DateOfBirth.Value.Month == today.Month
                        && x.DateOfBirth.Value.Day == today.Day)
            .ToListAsync(ct);

        if (candidates.Count == 0) return 0;

        // Recipients include the birthday employee, as required.
        var recipients = await db.Users
            .Where(x => x.IsActive && x.Email != "")
            .Select(x => x.Email)
            .ToListAsync(ct);

        var sent = 0;

        foreach (var employee in candidates)
        {
            // Claim the send first. If the unique index rejects the insert, another pass or
            // instance already handled this employee today and nothing further happens.
            var claim = new BirthdayEmailLog
            {
                EmployeeId = employee.Id,
                SentForDate = today,
                RecipientCount = recipients.Count,
            };

            db.BirthdayEmailLogs.Add(claim);

            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException)
            {
                db.Entry(claim).State = EntityState.Detached;
                logger.LogDebug("Birthday email for employee {EmployeeId} on {Date} was already sent.", employee.Id, today);
                continue;
            }

            var imageUrl = employee.ProfileImagePath is null
                ? null
                : $"{_app.ClientBaseUrl.TrimEnd('/')}/api/employees/{employee.Id}/profile-image";

            var (subject, body) = EmailTemplates.Birthday(_app.CompanyName, employee, imageUrl);
            var delivered = await email.SendAsync(new EmailMessage(recipients, subject, body), ct);

            if (!delivered)
            {
                // Keep the claim so a transient SMTP failure cannot turn into a mail storm on the
                // next tick; the failure is logged by the email service for follow-up.
                logger.LogWarning("Birthday email for employee {EmployeeId} could not be delivered.", employee.Id);
            }

            await notifications.NotifyAllAsync(
                $"Happy birthday, {employee.FullName}!",
                $"Wish {employee.FullName} a happy birthday today.",
                "Birthday", "/calendar", ct);

            sent++;
        }

        if (sent > 0) logger.LogInformation("Birthday mailer processed {Count} employee(s) for {Date}.", sent, today);
        return sent;
    }
}
