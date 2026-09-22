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
[Route("api/dashboard")]
public sealed class DashboardController(IDashboardService dashboard, HrmDbContext db) : ControllerBase
{
    [HttpGet("admin"), Authorize(Policy = "Admin")]
    public async Task<IActionResult> Admin(CancellationToken ct) =>
        Ok(new ApiResponse<AdminDashboardDto>(true, "Admin dashboard.", await dashboard.GetAdminAsync(ct)));

    [HttpGet("employee")]
    public async Task<IActionResult> Employee(CancellationToken ct)
    {
        var userId = User.UserId();
        var employeeId = await db.Employees.Where(x => x.UserId == userId).Select(x => (int?)x.Id).FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("No employee record is linked to your account. Please contact an administrator.");

        return Ok(new ApiResponse<EmployeeDashboardDto>(true, "Employee dashboard.",
            await dashboard.GetEmployeeAsync(employeeId, userId, ct)));
    }
}
