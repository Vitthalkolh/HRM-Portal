using HRM.Server.Data;
using HRM.Server.DTOs;
using HRM.Server.Infrastructure;
using HRM.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRM.Server.Controllers;

[ApiController]
[Authorize]
[Route("api/leaves")]
public sealed class LeavesController(ILeaveService leave, HrmDbContext db) : ControllerBase
{
    /// <summary>
    /// The five employee-applicable leave types. Management Leave and National Holiday are company
    /// calendar events and are deliberately not returned here, so they can never be applied for.
    /// </summary>
    [HttpGet("types")]
    public async Task<IActionResult> Types(CancellationToken ct) =>
        Ok(new ApiResponse<IReadOnlyList<LeaveTypeDto>>(true, "Leave types.", await leave.GetTypesAsync(ct)));

    [HttpGet("balance")]
    public async Task<IActionResult> Balance([FromQuery] int? year, [FromQuery] int? employeeId, CancellationToken ct = default)
    {
        var target = await ResolveEmployeeAsync(employeeId, ct);
        var balances = await leave.GetBalancesAsync(target, year ?? DateTime.UtcNow.Year, ct);
        return Ok(new ApiResponse<IReadOnlyList<LeaveBalanceDto>>(true, "Leave balances.", balances));
    }

    [HttpGet("history")]
    public async Task<IActionResult> History(
        [FromQuery] string? status,
        [FromQuery] int? employeeId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        // An employee is always scoped to their own record; only an admin may widen the query.
        int? scope = User.IsAdmin() ? employeeId : await CurrentEmployeeIdAsync(ct);
        var result = await leave.GetRequestsAsync(scope, status, page, pageSize, ct);
        return Ok(new ApiResponse<PagedResult<LeaveRequestDto>>(true, "Leave requests.", result));
    }

    /// <summary>Server-side day count, so the client never has to guess how weekends and holidays are treated.</summary>
    [HttpPost("preview")]
    public async Task<IActionResult> Preview(LeaveDaysPreviewRequest request, CancellationToken ct) =>
        Ok(new ApiResponse<LeaveDaysPreviewDto>(true, "Working days.", await leave.PreviewAsync(request, ct)));

    [HttpPost]
    public async Task<IActionResult> Apply(LeaveCreateRequest request, CancellationToken ct)
    {
        var employeeId = await CurrentEmployeeIdAsync(ct);
        var created = await leave.ApplyAsync(employeeId, request, ct);
        return Ok(new ApiResponse<LeaveRequestDto>(true, "Leave request submitted for approval.", created));
    }

    [HttpPost("{id:int}/approve"), Authorize(Policy = "Admin")]
    public async Task<IActionResult> Approve(int id, ReviewLeaveRequest request, CancellationToken ct) =>
        Ok(new ApiResponse<LeaveRequestDto>(true, "Leave approved and the balance updated.",
            await leave.ApproveAsync(id, User.UserId(), request.Comment, ct)));

    [HttpPost("{id:int}/reject"), Authorize(Policy = "Admin")]
    public async Task<IActionResult> Reject(int id, ReviewLeaveRequest request, CancellationToken ct) =>
        Ok(new ApiResponse<LeaveRequestDto>(true, "Leave rejected. No balance was deducted.",
            await leave.RejectAsync(id, User.UserId(), request.Comment, ct)));

    [HttpPost("{id:int}/cancel"), Authorize(Policy = "Admin")]
    public async Task<IActionResult> Cancel(int id, ReviewLeaveRequest request, CancellationToken ct) =>
        Ok(new ApiResponse<LeaveRequestDto>(true, "Leave cancelled and the balance restored.",
            await leave.CancelAsync(id, User.UserId(), request.Comment, ct)));

    /// <summary>An employee may withdraw only their own pending request.</summary>
    [HttpPost("{id:int}/withdraw")]
    public async Task<IActionResult> Withdraw(int id, CancellationToken ct) =>
        Ok(new ApiResponse<LeaveRequestDto>(true, "Leave request withdrawn.",
            await leave.WithdrawAsync(id, await CurrentEmployeeIdAsync(ct), ct)));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        var item = await db.LeaveRequests.AsNoTracking()
            .Where(x => x.Id == id)
            .Select(LeaveService.Projection)
            .FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("That leave request could not be found.");

        // Direct-id access is checked against ownership, not just authentication.
        if (!User.IsAdmin() && item.EmployeeId != await CurrentEmployeeIdAsync(ct))
            throw AppException.Forbidden("You can only view your own leave requests.");

        return Ok(new ApiResponse<LeaveRequestDto>(true, "Leave request.", item));
    }

    private async Task<int> CurrentEmployeeIdAsync(CancellationToken ct)
    {
        var userId = User.UserId();
        var id = await db.Employees.Where(x => x.UserId == userId).Select(x => (int?)x.Id).FirstOrDefaultAsync(ct);
        return id ?? throw AppException.NotFound("No employee record is linked to your account. Please contact an administrator.");
    }

    private async Task<int> ResolveEmployeeAsync(int? requested, CancellationToken ct)
    {
        var self = await CurrentEmployeeIdAsync(ct);
        if (requested is null || requested == self) return self;
        if (!User.IsAdmin()) throw AppException.Forbidden("You can only view your own leave balance.");
        return requested.Value;
    }
}
