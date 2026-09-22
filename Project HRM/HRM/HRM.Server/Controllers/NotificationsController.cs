using HRM.Server.Data;
using HRM.Server.DTOs;
using HRM.Server.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRM.Server.Controllers;

[ApiController]
[Authorize]
[Route("api/notifications")]
public sealed class NotificationsController(HrmDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] bool unreadOnly = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var userId = User.UserId();
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var query = db.Notifications.AsNoTracking().Where(x => x.UserId == userId);
        if (unreadOnly) query = query.Where(x => !x.IsRead);

        var unreadCount = await db.Notifications.CountAsync(x => x.UserId == userId && !x.IsRead, ct);

        var items = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new NotificationDto(x.Id, x.Title, x.Body, x.Type, x.IsRead, x.Link, x.CreatedAtUtc))
            .ToListAsync(ct);

        return Ok(new ApiResponse<NotificationSummaryDto>(true, "Notifications.",
            new NotificationSummaryDto(unreadCount, items)));
    }

    [HttpGet("unread-count")]
    public async Task<IActionResult> UnreadCount(CancellationToken ct)
    {
        var userId = User.UserId();
        var count = await db.Notifications.CountAsync(x => x.UserId == userId && !x.IsRead, ct);
        return Ok(new ApiResponse<int>(true, "Unread notifications.", count));
    }

    [HttpPost("{id:int}/read")]
    public async Task<IActionResult> Read(int id, CancellationToken ct)
    {
        var userId = User.UserId();

        // Scoped by user id, so one account cannot mark another account's notification as read.
        var updated = await db.Notifications
            .Where(x => x.Id == id && x.UserId == userId)
            .ExecuteUpdateAsync(x => x.SetProperty(y => y.IsRead, true), ct);

        if (updated == 0) throw AppException.NotFound("That notification could not be found.");
        return Ok(new ApiResponse<object>(true, "Notification marked as read."));
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> ReadAll(CancellationToken ct)
    {
        var userId = User.UserId();
        var updated = await db.Notifications
            .Where(x => x.UserId == userId && !x.IsRead)
            .ExecuteUpdateAsync(x => x.SetProperty(y => y.IsRead, true), ct);

        return Ok(new ApiResponse<object>(true, $"{updated} notification(s) marked as read."));
    }
}
