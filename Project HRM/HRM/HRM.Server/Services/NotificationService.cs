using HRM.Server.Data;
using HRM.Server.Entities;
using Microsoft.EntityFrameworkCore;

namespace HRM.Server.Services;

public interface INotificationService
{
    Task NotifyAsync(int userId, string title, string body, string type, string? link = null, CancellationToken ct = default);
    Task NotifyAllAsync(string title, string body, string type, string? link = null, CancellationToken ct = default);
}

/// <summary>
/// In-app notifications. Deliberately separate from email: not every notification is an email,
/// and only leave approval, birthdays and password reset produce mail.
/// </summary>
public sealed class NotificationService(HrmDbContext db, ILogger<NotificationService> logger) : INotificationService
{
    public async Task NotifyAsync(int userId, string title, string body, string type, string? link = null, CancellationToken ct = default)
    {
        db.Notifications.Add(new Notification { UserId = userId, Title = title, Body = body, Type = type, Link = link });
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Notification '{Title}' queued for user {UserId}.", title, userId);
    }

    public async Task NotifyAllAsync(string title, string body, string type, string? link = null, CancellationToken ct = default)
    {
        var userIds = await db.Users.Where(x => x.IsActive).Select(x => x.Id).ToListAsync(ct);

        db.Notifications.AddRange(userIds.Select(id => new Notification
        {
            UserId = id, Title = title, Body = body, Type = type, Link = link,
        }));

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Notification '{Title}' queued for {Count} user(s).", title, userIds.Count);
    }
}
