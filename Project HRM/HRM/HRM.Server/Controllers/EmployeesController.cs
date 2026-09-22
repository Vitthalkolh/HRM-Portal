using HRM.Server.Data;
using HRM.Server.DTOs;
using HRM.Server.Entities;
using HRM.Server.Infrastructure;
using HRM.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRM.Server.Controllers;

[ApiController]
[Authorize]
[Route("api/employees")]
public sealed class EmployeesController(
    HrmDbContext db,
    IFileStorage files,
    ILeaveService leave,
    IAuditService audit) : ControllerBase
{
    // ------------------------------------------------------------------ own profile

    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var employee = await CurrentEmployeeAsync(ct);
        return Ok(new ApiResponse<EmployeeDetailDto>(true, "Your profile.", await DetailAsync(employee.Id, ct)));
    }

    /// <summary>Self-service profile edit. Employment terms, role and credentials are not editable here.</summary>
    [HttpPut("me")]
    public async Task<IActionResult> UpdateMe(UpdateOwnProfileRequest request, CancellationToken ct)
    {
        var employee = await CurrentEmployeeAsync(ct);

        employee.FirstName = request.FirstName.Trim();
        employee.LastName = request.LastName.Trim();
        employee.Phone = request.Phone?.Trim();
        employee.Location = request.Location?.Trim();
        employee.DateOfBirth = request.DateOfBirth;
        employee.UpdatedAtUtc = DateTime.UtcNow;

        if (employee.DateOfBirth is { } dob && dob > DateOnly.FromDateTime(DateTime.UtcNow))
            throw AppException.BadRequest("A date of birth cannot be in the future.");

        await db.SaveChangesAsync(ct);
        await audit.RecordAsync("Employee", "UpdateOwnProfile", employee.Id.ToString(), null, ct: ct);

        return Ok(new ApiResponse<EmployeeDetailDto>(true, "Your profile has been saved.", await DetailAsync(employee.Id, ct)));
    }

    // ------------------------------------------------------------------ profile image

    [HttpPost("me/profile-image")]
    [RequestSizeLimit(4 * 1024 * 1024)]
    public async Task<IActionResult> UploadProfileImage(IFormFile file, CancellationToken ct)
    {
        var employee = await CurrentEmployeeAsync(ct);
        var previous = employee.ProfileImagePath;

        var stored = await files.SaveAsync(file, FileCategory.ProfileImage, employee.Id, User.UserId(), ct);
        employee.ProfileImagePath = stored.StoragePath;
        employee.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        // Replace only after the new image is safely stored.
        if (previous is not null) files.Delete(previous);

        await audit.RecordAsync("Employee", "UploadProfileImage", employee.Id.ToString(), null, ct: ct);

        return Ok(new ApiResponse<object>(true, "Profile photo updated.",
            new { profileImageUrl = $"/api/employees/{employee.Id}/profile-image" }));
    }

    [HttpDelete("me/profile-image")]
    public async Task<IActionResult> DeleteProfileImage(CancellationToken ct)
    {
        var employee = await CurrentEmployeeAsync(ct);
        if (employee.ProfileImagePath is null)
            return Ok(new ApiResponse<object>(true, "There is no profile photo to remove."));

        var path = employee.ProfileImagePath;
        employee.ProfileImagePath = null;
        employee.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        files.Delete(path);

        await audit.RecordAsync("Employee", "DeleteProfileImage", employee.Id.ToString(), null, ct: ct);
        return Ok(new ApiResponse<object>(true, "Profile photo removed."));
    }

    /// <summary>
    /// Serves an employee's photo. Any signed-in colleague may see it (it is directory
    /// information), but the bytes are always served through this authorized endpoint so that
    /// no filesystem path is ever exposed.
    /// </summary>
    [HttpGet("{id:int}/profile-image")]
    public async Task<IActionResult> GetProfileImage(int id, CancellationToken ct)
    {
        var path = await db.Employees.Where(x => x.Id == id).Select(x => x.ProfileImagePath).FirstOrDefaultAsync(ct);
        if (path is null) throw AppException.NotFound("That employee has no profile photo.");

        var record = await db.StoredFiles.FirstOrDefaultAsync(x => x.StoragePath == path, ct)
            ?? throw AppException.NotFound("That profile photo is no longer available.");

        var stream = await files.OpenReadAsync(record, ct);
        return File(stream, record.ContentType);
    }

    // ------------------------------------------------------------------ directory & admin

    /// <summary>Colleague directory. Employees see a deliberately narrow view.</summary>
    [HttpGet("directory")]
    public async Task<IActionResult> Directory([FromQuery] string? search, CancellationToken ct = default)
    {
        var query = db.Employees.AsNoTracking().Where(x => x.User.IsActive);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x =>
                x.FirstName.Contains(term) || x.LastName.Contains(term) ||
                x.EmployeeCode.Contains(term) || (x.Department != null && x.Department.Contains(term)));
        }

        var items = await query
            .OrderBy(x => x.FirstName).ThenBy(x => x.LastName)
            .Select(x => new EmployeeDirectoryDto(
                x.Id, x.EmployeeCode, x.FirstName + " " + x.LastName, x.Department, x.Designation,
                x.ProfileImagePath == null ? null : "/api/employees/" + x.Id + "/profile-image"))
            .ToListAsync(ct);

        return Ok(new ApiResponse<IReadOnlyList<EmployeeDirectoryDto>>(true, "Employee directory.", items));
    }

    [HttpGet, Authorize(Policy = "Admin")]
    public async Task<IActionResult> List(
        [FromQuery] string? search,
        [FromQuery] bool? activeOnly,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.Employees.AsNoTracking().Include(x => x.User).AsQueryable();

        if (activeOnly == true) query = query.Where(x => x.User.IsActive);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x =>
                x.FirstName.Contains(term) || x.LastName.Contains(term) ||
                x.EmployeeCode.Contains(term) || x.User.Email.Contains(term));
        }

        var total = await query.CountAsync(ct);

        var items = await query
            .OrderBy(x => x.FirstName).ThenBy(x => x.LastName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new EmployeeListItemDto(
                x.Id, x.EmployeeCode, x.FirstName + " " + x.LastName, x.User.Email,
                x.Department, x.Designation, x.JoiningDate, x.EmploymentStatus.ToString(),
                x.User.IsActive, x.User.Role.ToString(),
                x.ProfileImagePath == null ? null : "/api/employees/" + x.Id + "/profile-image"))
            .ToListAsync(ct);

        return Ok(new ApiResponse<PagedResult<EmployeeListItemDto>>(true, "Employees.",
            new PagedResult<EmployeeListItemDto>(items, page, pageSize, total)));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        // An employee may read their own full record; anything else is administrator-only.
        if (!User.IsAdmin())
        {
            var self = await CurrentEmployeeAsync(ct);
            if (self.Id != id) throw AppException.Forbidden("You can only view your own profile.");
        }

        return Ok(new ApiResponse<EmployeeDetailDto>(true, "Employee.", await DetailAsync(id, ct)));
    }

    [HttpPost, Authorize(Policy = "Admin")]
    public async Task<IActionResult> Create(CreateEmployeeRequest request, CancellationToken ct)
    {
        if (!Enum.TryParse<RoleName>(request.Role, true, out var role))
            throw AppException.BadRequest("Role must be either Admin or Employee.");

        var email = request.Email.Trim().ToLowerInvariant();
        var userName = request.UserName.Trim();

        if (await db.Users.AnyAsync(x => x.Email == email, ct))
            throw AppException.Conflict("An account already exists with that email address.");

        if (await db.Users.AnyAsync(x => x.UserName == userName, ct))
            throw AppException.Conflict("That username is already taken.");

        if (await db.Employees.AnyAsync(x => x.EmployeeCode == request.EmployeeCode, ct))
            throw AppException.Conflict("That employee code is already in use.");

        var user = new User
        {
            UserName = userName,
            Email = email,
            Role = role,
            // The administrator sets a temporary password; the employee is prompted to change it
            // from their profile, never force-redirected.
            MustChangePassword = true,
        };

        user.PasswordHash = new PasswordHasher<User>().HashPassword(user, request.TemporaryPassword);
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        var employee = new Employee
        {
            UserId = user.Id,
            EmployeeCode = request.EmployeeCode.Trim(),
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            Phone = request.Phone?.Trim(),
            Department = request.Department?.Trim(),
            Designation = request.Designation?.Trim(),
            Location = request.Location?.Trim(),
            JoiningDate = request.JoiningDate,
            DateOfBirth = request.DateOfBirth,
        };

        db.Employees.Add(employee);
        await db.SaveChangesAsync(ct);

        // Allocate this year's leave balances immediately, otherwise the employee cannot apply.
        await leave.EnsureBalancesAsync(employee.Id, DateTime.UtcNow.Year, ct);

        await audit.RecordAsync("Employee", "Create", employee.Id.ToString(), $"{employee.EmployeeCode} ({role})", ct: ct);

        return Ok(new ApiResponse<EmployeeDetailDto>(true, "Employee created.", await DetailAsync(employee.Id, ct)));
    }

    [HttpPut("{id:int}"), Authorize(Policy = "Admin")]
    public async Task<IActionResult> Update(int id, UpdateEmployeeRequest request, CancellationToken ct)
    {
        var employee = await db.Employees.Include(x => x.User).FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("That employee could not be found.");

        if (!Enum.TryParse<RoleName>(request.Role, true, out var role))
            throw AppException.BadRequest("Role must be either Admin or Employee.");

        if (!Enum.TryParse<EmploymentStatus>(request.EmploymentStatus, true, out var status))
            throw AppException.BadRequest("Employment status must be Active, NoticePeriod or Resigned.");

        var email = request.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(x => x.Email == email && x.Id != employee.UserId, ct))
            throw AppException.Conflict("Another account already uses that email address.");

        if (status != EmploymentStatus.Active && request.LastWorkingDate is null)
            throw AppException.BadRequest("A last working day is required once an employee is on notice or has resigned.");

        // Removing the last administrator would lock everyone out of the admin area.
        if (employee.User.Role == RoleName.Admin && role != RoleName.Admin)
        {
            var otherAdmins = await db.Users.CountAsync(x => x.Role == RoleName.Admin && x.IsActive && x.Id != employee.UserId, ct);
            if (otherAdmins == 0) throw AppException.BadRequest("At least one active administrator must remain.");
        }

        employee.FirstName = request.FirstName.Trim();
        employee.LastName = request.LastName.Trim();
        employee.Phone = request.Phone?.Trim();
        employee.Department = request.Department?.Trim();
        employee.Designation = request.Designation?.Trim();
        employee.Location = request.Location?.Trim();
        employee.JoiningDate = request.JoiningDate;
        employee.DateOfBirth = request.DateOfBirth;
        employee.EmploymentStatus = status;
        employee.ResignationDate = request.ResignationDate;
        employee.LastWorkingDate = request.LastWorkingDate;
        employee.UpdatedAtUtc = DateTime.UtcNow;

        employee.User.Email = email;
        employee.User.Role = role;
        employee.User.IsActive = request.IsActive;
        employee.User.UpdatedAtUtc = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        await audit.RecordAsync("Employee", "Update", employee.Id.ToString(), $"status={status}, role={role}, active={request.IsActive}", ct: ct);

        return Ok(new ApiResponse<EmployeeDetailDto>(true, "Employee updated.", await DetailAsync(employee.Id, ct)));
    }

    /// <summary>
    /// Sets a new password for an employee. An administrator can never read an existing password;
    /// only replace it.
    /// </summary>
    [HttpPost("{id:int}/reset-password"), Authorize(Policy = "Admin")]
    public async Task<IActionResult> ResetPassword(int id, AdminResetPasswordRequest request, CancellationToken ct)
    {
        var employee = await db.Employees.Include(x => x.User).FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("That employee could not be found.");

        employee.User.PasswordHash = new PasswordHasher<User>().HashPassword(employee.User, request.NewPassword);
        employee.User.MustChangePassword = request.RequireChangeOnNextLogin;
        employee.User.FailedLoginCount = 0;
        employee.User.LockedOutUntilUtc = null;
        employee.User.UpdatedAtUtc = DateTime.UtcNow;

        // Every existing session for that account is ended.
        await db.RefreshTokens
            .Where(x => x.UserId == employee.UserId && x.RevokedAtUtc == null)
            .ExecuteUpdateAsync(x => x.SetProperty(y => y.RevokedAtUtc, DateTime.UtcNow), ct);

        await db.SaveChangesAsync(ct);

        // The new password itself is deliberately not written to the audit trail.
        await audit.RecordAsync("Employee", "AdminResetPassword", employee.Id.ToString(), null, ct: ct);

        return Ok(new ApiResponse<object>(true, "Password reset. Share it with the employee over a secure channel."));
    }

    [HttpPost("{id:int}/deactivate"), Authorize(Policy = "Admin")]
    public async Task<IActionResult> Deactivate(int id, CancellationToken ct)
    {
        var employee = await db.Employees.Include(x => x.User).FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("That employee could not be found.");

        if (employee.UserId == User.UserId())
            throw AppException.BadRequest("You cannot deactivate your own account.");

        if (employee.User.Role == RoleName.Admin)
        {
            var otherAdmins = await db.Users.CountAsync(x => x.Role == RoleName.Admin && x.IsActive && x.Id != employee.UserId, ct);
            if (otherAdmins == 0) throw AppException.BadRequest("At least one active administrator must remain.");
        }

        // Deactivation, never deletion: leave history and audit records must survive.
        employee.User.IsActive = false;
        employee.User.UpdatedAtUtc = DateTime.UtcNow;

        await db.RefreshTokens
            .Where(x => x.UserId == employee.UserId && x.RevokedAtUtc == null)
            .ExecuteUpdateAsync(x => x.SetProperty(y => y.RevokedAtUtc, DateTime.UtcNow), ct);

        await db.SaveChangesAsync(ct);
        await audit.RecordAsync("Employee", "Deactivate", employee.Id.ToString(), null, ct: ct);

        return Ok(new ApiResponse<object>(true, "Employee deactivated."));
    }

    [HttpPost("{id:int}/activate"), Authorize(Policy = "Admin")]
    public async Task<IActionResult> Activate(int id, CancellationToken ct)
    {
        var employee = await db.Employees.Include(x => x.User).FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("That employee could not be found.");

        employee.User.IsActive = true;
        employee.User.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        await audit.RecordAsync("Employee", "Activate", employee.Id.ToString(), null, ct: ct);

        return Ok(new ApiResponse<object>(true, "Employee reactivated."));
    }

    // ------------------------------------------------------------------ helpers

    private async Task<Employee> CurrentEmployeeAsync(CancellationToken ct)
    {
        var userId = User.UserId();
        return await db.Employees.FirstOrDefaultAsync(x => x.UserId == userId, ct)
            ?? throw AppException.NotFound("No employee record is linked to your account. Please contact an administrator.");
    }

    private async Task<EmployeeDetailDto> DetailAsync(int employeeId, CancellationToken ct)
    {
        var employee = await db.Employees
            .AsNoTracking()
            .Include(x => x.User)
            .FirstOrDefaultAsync(x => x.Id == employeeId, ct)
            ?? throw AppException.NotFound("That employee could not be found.");

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var holidays = (await db.NationalHolidays
                .Where(x => x.Date >= employee.JoiningDate && x.Date <= today)
                .Select(x => x.Date)
                .ToListAsync(ct))
            .ToHashSet();

        return new EmployeeDetailDto(
            employee.Id,
            employee.UserId,
            employee.EmployeeCode,
            employee.FirstName,
            employee.LastName,
            employee.FullName,
            employee.User.Email,
            employee.User.UserName,
            employee.User.Role.ToString(),
            employee.Phone,
            employee.Department,
            employee.Designation,
            employee.Location,
            employee.JoiningDate,
            employee.DateOfBirth,
            employee.EmploymentStatus.ToString(),
            employee.ResignationDate,
            employee.LastWorkingDate,
            employee.ProfileImagePath is null ? null : $"/api/employees/{employee.Id}/profile-image",
            employee.User.IsActive,
            WorkingDaysCalculator.Duration(employee.JoiningDate, today, holidays));
    }
}
