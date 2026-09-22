using HRM.Server.Data;
using HRM.Server.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRM.Server.Controllers;

/// <summary>Administrator-only view of the audit trail.</summary>
[ApiController]
[Authorize(Policy = "Admin")]
[Route("api/audit-logs")]
public sealed class AuditLogsController(HrmDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? module,
        [FromQuery] string? action,
        [FromQuery] int? userId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken ct = default)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.AuditLogs.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(module)) query = query.Where(x => x.Module == module);
        if (!string.IsNullOrWhiteSpace(action)) query = query.Where(x => x.Action == action);
        if (userId is not null) query = query.Where(x => x.UserId == userId);

        var total = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new AuditLogDto(x.Id, x.UserId, x.UserName, x.Action, x.Module, x.EntityId, x.Details, x.IpAddress, x.CreatedAtUtc))
            .ToListAsync(ct);

        return Ok(new ApiResponse<PagedResult<AuditLogDto>>(true, "Audit log.",
            new PagedResult<AuditLogDto>(items, page, pageSize, total)));
    }

    [HttpGet("modules")]
    public async Task<IActionResult> Modules(CancellationToken ct)
    {
        var modules = await db.AuditLogs.Select(x => x.Module).Distinct().OrderBy(x => x).ToListAsync(ct);
        return Ok(new ApiResponse<IReadOnlyList<string>>(true, "Audited modules.", modules));
    }
}
