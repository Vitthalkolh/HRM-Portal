using HRM.Server.DTOs;
using HRM.Server.Infrastructure;
using HRM.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace HRM.Server.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(IAuthService auth) : ControllerBase
{
    [HttpPost("login"), AllowAnonymous, EnableRateLimiting("auth")]
    public async Task<IActionResult> Login(LoginRequest request, CancellationToken ct)
    {
        var data = await auth.LoginAsync(request, ct);
        return data is null
            ? Unauthorized(new ApiResponse<object>(false, "That email/username and password combination is not correct."))
            : Ok(new ApiResponse<TokenResponse>(true, "Signed in.", data));
    }

    [HttpPost("refresh"), AllowAnonymous, EnableRateLimiting("auth")]
    public async Task<IActionResult> Refresh(RefreshRequest request, CancellationToken ct)
    {
        var data = await auth.RefreshAsync(request.RefreshToken, ct);
        return data is null
            ? Unauthorized(new ApiResponse<object>(false, "Your session has expired. Please sign in again."))
            : Ok(new ApiResponse<TokenResponse>(true, "Session refreshed.", data));
    }

    [HttpPost("logout"), Authorize]
    public async Task<IActionResult> Logout(RefreshRequest request, CancellationToken ct)
    {
        await auth.LogoutAsync(request.RefreshToken, User.UserId(), ct);
        return Ok(new ApiResponse<object>(true, "Signed out."));
    }

    [HttpGet("me"), Authorize]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var user = await auth.GetCurrentUserAsync(User.UserId(), ct);
        return user is null
            ? Unauthorized(new ApiResponse<object>(false, "Your account is no longer active."))
            : Ok(new ApiResponse<UserDto>(true, "Current user.", user));
    }

    [HttpPost("forgot-password"), AllowAnonymous, EnableRateLimiting("auth")]
    public async Task<IActionResult> Forgot(ForgotPasswordRequest request, CancellationToken ct)
    {
        await auth.RequestPasswordResetAsync(request.Email, ct);

        // The same answer is returned whether or not the address exists, so the endpoint
        // cannot be used to discover which addresses are registered.
        return Ok(new ApiResponse<object>(true,
            "If an account exists for that address, password reset instructions have been sent."));
    }

    [HttpPost("reset-password"), AllowAnonymous, EnableRateLimiting("auth")]
    public async Task<IActionResult> Reset(ResetPasswordRequest request, CancellationToken ct) =>
        await auth.ResetPasswordAsync(request, ct)
            ? Ok(new ApiResponse<object>(true, "Your password has been updated. Please sign in."))
            : BadRequest(new ApiResponse<object>(false,
                "That reset link is invalid or has expired, or the passwords did not match."));

    [HttpPost("change-password"), Authorize]
    public async Task<IActionResult> Change(ChangePasswordRequest request, CancellationToken ct) =>
        await auth.ChangePasswordAsync(User.UserId(), request, ct)
            ? Ok(new ApiResponse<object>(true, "Your password has been updated. Please sign in again."))
            : BadRequest(new ApiResponse<object>(false,
                "Your current password is not correct, or the new passwords did not match."));
}
