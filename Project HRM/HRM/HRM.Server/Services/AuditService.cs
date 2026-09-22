using HRM.Server.Data;
using HRM.Server.Entities;
using HRM.Server.Infrastructure;

namespace HRM.Server.Services;

public interface IAuditService
{
    /// <summary>
    /// Records an auditable operation. Never call with passwords, hashes or reset tokens in
    /// <paramref name="details"/> — the audit trail is readable by every administrator.
    /// </summary>
    Task RecordAsync(string module, string action, string entityId, string? details = null, int? userId = null, string? userName = null, CancellationToken ct = default);
}

public sealed class AuditService(HrmDbContext db, IHttpContextAccessor accessor, ILogger<AuditService> logger) : IAuditService
{
    public async Task RecordAsync(
        string module, string action, string entityId, string? details = null,
        int? userId = null, string? userName = null, CancellationToken ct = default)
    {
        try
        {
            var principal = accessor.HttpContext?.User;
            var resolvedUserId = userId;
            var resolvedUserName = userName;

            if (resolvedUserId is null && principal?.Identity?.IsAuthenticated == true)
            {
                resolvedUserId = principal.UserId();
                resolvedUserName ??= principal.UserName();
            }

            db.AuditLogs.Add(new AuditLog
            {
                UserId = resolvedUserId,
                UserName = resolvedUserName ?? "system",
                Module = module,
                Action = action,
                EntityId = entityId,
                Details = Truncate(details, 2000),
                IpAddress = accessor.HttpContext?.Connection.RemoteIpAddress?.ToString(),
            });

            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            // Auditing must never take down the operation it is recording.
            logger.LogError(ex, "Failed to write audit entry {Module}/{Action} for {EntityId}.", module, action, entityId);
        }
    }

    private static string? Truncate(string? value, int max) =>
        value is null || value.Length <= max ? value : value[..max];
}
