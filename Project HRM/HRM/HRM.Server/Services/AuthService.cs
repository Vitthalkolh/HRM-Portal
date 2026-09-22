using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using HRM.Server.Data;
using HRM.Server.DTOs;
using HRM.Server.Entities;
using HRM.Server.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace HRM.Server.Services;

public interface IAuthService
{
    Task<TokenResponse?> LoginAsync(LoginRequest request, CancellationToken ct = default);
    Task<TokenResponse?> RefreshAsync(string token, CancellationToken ct = default);
    Task LogoutAsync(string token, int userId, CancellationToken ct = default);
    Task<bool> ChangePasswordAsync(int userId, ChangePasswordRequest request, CancellationToken ct = default);
    Task RequestPasswordResetAsync(string email, CancellationToken ct = default);
    Task<bool> ResetPasswordAsync(ResetPasswordRequest request, CancellationToken ct = default);
    Task<UserDto?> GetCurrentUserAsync(int userId, CancellationToken ct = default);
}

public sealed class AuthService(
    HrmDbContext db,
    IOptions<JwtOptions> jwtOptions,
    IOptions<AppOptions> appOptions,
    IEmailService email,
    IAuditService audit,
    ILogger<AuthService> logger) : IAuthService
{
    /// <summary>Failed attempts before a temporary lockout, and how long that lockout lasts.</summary>
    private const int MaxFailedAttempts = 5;
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);
    private const int ResetTokenMinutes = 60;

    private readonly PasswordHasher<User> _hasher = new();
    private readonly JwtOptions _jwt = jwtOptions.Value;
    private readonly AppOptions _app = appOptions.Value;

    public async Task<TokenResponse?> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var user = await db.Users
            .Include(x => x.Employee)
            .FirstOrDefaultAsync(x => x.Email == request.Login || x.UserName == request.Login, ct);

        if (user is null)
        {
            // Hash anyway so a missing account costs the same time as a wrong password,
            // removing the user-enumeration timing signal.
            _ = _hasher.HashPassword(new User(), request.Password);
            logger.LogInformation("Failed sign-in for an unknown login.");
            return null;
        }

        if (user.LockedOutUntilUtc is { } until && until > DateTime.UtcNow)
        {
            logger.LogWarning("Sign-in refused for user {UserId}: locked out until {Until}.", user.Id, until);
            throw AppException.Unauthorized(
                $"Too many failed attempts. Try again after {(until - DateTime.UtcNow).TotalMinutes:0} minute(s).");
        }

        if (!user.IsActive)
        {
            logger.LogWarning("Sign-in refused for deactivated user {UserId}.", user.Id);
            return null;
        }

        if (_hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password) == PasswordVerificationResult.Failed)
        {
            user.FailedLoginCount++;
            if (user.FailedLoginCount >= MaxFailedAttempts)
            {
                user.LockedOutUntilUtc = DateTime.UtcNow.Add(LockoutDuration);
                user.FailedLoginCount = 0;
                logger.LogWarning("User {UserId} locked out after repeated failed sign-ins.", user.Id);
            }

            await db.SaveChangesAsync(ct);
            await audit.RecordAsync("Auth", "LoginFailed", user.Id.ToString(), null, user.Id, user.UserName, ct);
            return null;
        }

        user.FailedLoginCount = 0;
        user.LockedOutUntilUtc = null;
        user.LastLoginAtUtc = DateTime.UtcNow;

        var response = await IssueAsync(user, request.RememberMe, ct);
        await audit.RecordAsync("Auth", "Login", user.Id.ToString(), null, user.Id, user.UserName, ct);
        return response;
    }

    public async Task<TokenResponse?> RefreshAsync(string token, CancellationToken ct = default)
    {
        var hash = Hash(token);
        var stored = await db.RefreshTokens
            .Include(x => x.User).ThenInclude(x => x!.Employee)
            .FirstOrDefaultAsync(x => x.TokenHash == hash, ct);

        if (stored is null) return null;

        // A token presented after it was rotated or revoked indicates theft or replay:
        // drop every session for that user rather than failing quietly.
        if (!stored.IsActive)
        {
            logger.LogWarning("Reuse of an inactive refresh token for user {UserId}; revoking all sessions.", stored.UserId);
            await RevokeAllAsync(stored.UserId, ct);
            await audit.RecordAsync("Auth", "RefreshTokenReuse", stored.UserId.ToString(), null, stored.UserId, ct: ct);
            return null;
        }

        if (!stored.User.IsActive) return null;

        var result = await IssueAsync(stored.User, remember: true, ct, rotating: stored);
        return result;
    }

    public async Task LogoutAsync(string token, int userId, CancellationToken ct = default)
    {
        var item = await db.RefreshTokens.FirstOrDefaultAsync(x => x.TokenHash == Hash(token), ct);

        if (item is not null && item.UserId == userId)
        {
            item.RevokedAtUtc = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }
        else
        {
            // Either no token was supplied or it belongs to someone else; end every session
            // for the caller so the visible outcome is always "signed out".
            await RevokeAllAsync(userId, ct);
        }

        await audit.RecordAsync("Auth", "Logout", userId.ToString(), null, userId, ct: ct);
    }

    public async Task<bool> ChangePasswordAsync(int userId, ChangePasswordRequest request, CancellationToken ct = default)
    {
        if (request.NewPassword != request.ConfirmPassword) return false;
        if (request.NewPassword == request.CurrentPassword)
            throw AppException.BadRequest("The new password must be different from the current one.");

        var user = await db.Users.FindAsync([userId], ct);
        if (user is null) return false;

        if (_hasher.VerifyHashedPassword(user, user.PasswordHash, request.CurrentPassword) == PasswordVerificationResult.Failed)
            return false;

        user.PasswordHash = _hasher.HashPassword(user, request.NewPassword);
        user.MustChangePassword = false;
        user.UpdatedAtUtc = DateTime.UtcNow;

        await RevokeAllAsync(userId, ct);
        await db.SaveChangesAsync(ct);
        await audit.RecordAsync("Auth", "ChangePassword", userId.ToString(), null, userId, user.UserName, ct);
        return true;
    }

    public async Task RequestPasswordResetAsync(string emailAddress, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(x => x.Email == emailAddress && x.IsActive, ct);

        // The caller always receives the same answer; only the side effect differs.
        if (user is null)
        {
            logger.LogInformation("Password reset requested for an address with no active account.");
            return;
        }

        var raw = NewToken();
        db.PasswordResetTokens.Add(new PasswordResetToken
        {
            UserId = user.Id,
            TokenHash = Hash(raw),
            ExpiresAtUtc = DateTime.UtcNow.AddMinutes(ResetTokenMinutes),
        });

        await db.SaveChangesAsync(ct);

        var link = $"{_app.ClientBaseUrl.TrimEnd('/')}/reset-password?token={Uri.EscapeDataString(raw)}";
        var (subject, body) = EmailTemplates.PasswordReset(_app.CompanyName, link, ResetTokenMinutes);
        await email.SendAsync(new EmailMessage([user.Email], subject, body), ct);

        // The token itself is never written to the audit trail.
        await audit.RecordAsync("Auth", "PasswordResetRequested", user.Id.ToString(), null, user.Id, user.UserName, ct);
    }

    public async Task<bool> ResetPasswordAsync(ResetPasswordRequest request, CancellationToken ct = default)
    {
        if (request.NewPassword != request.ConfirmPassword) return false;

        var hash = Hash(request.Token);
        var item = await db.PasswordResetTokens
            .Where(x => x.TokenHash == hash && x.UsedAtUtc == null && x.ExpiresAtUtc > DateTime.UtcNow)
            .OrderByDescending(x => x.Id)
            .FirstOrDefaultAsync(ct);

        if (item is null) return false;

        var user = await db.Users.FindAsync([item.UserId], ct);
        if (user is null || !user.IsActive) return false;

        user.PasswordHash = _hasher.HashPassword(user, request.NewPassword);
        user.MustChangePassword = false;
        user.FailedLoginCount = 0;
        user.LockedOutUntilUtc = null;
        user.UpdatedAtUtc = DateTime.UtcNow;
        item.UsedAtUtc = DateTime.UtcNow;

        await RevokeAllAsync(user.Id, ct);
        await db.SaveChangesAsync(ct);
        await audit.RecordAsync("Auth", "PasswordReset", user.Id.ToString(), null, user.Id, user.UserName, ct);
        return true;
    }

    public async Task<UserDto?> GetCurrentUserAsync(int userId, CancellationToken ct = default)
    {
        var user = await db.Users.Include(x => x.Employee).FirstOrDefaultAsync(x => x.Id == userId && x.IsActive, ct);
        return user is null ? null : ToDto(user);
    }

    private async Task<TokenResponse> IssueAsync(User user, bool remember, CancellationToken ct, RefreshToken? rotating = null)
    {
        var expires = DateTime.UtcNow.AddMinutes(_jwt.AccessTokenMinutes);
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Secret));

        var jwt = new JwtSecurityToken(
            _jwt.Issuer,
            _jwt.Audience,
            [
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.UserName),
                new Claim(ClaimTypes.Role, user.Role.ToString()),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            ],
            expires: expires,
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        var refresh = NewToken();
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = Hash(refresh),
            ExpiresAtUtc = DateTime.UtcNow.AddDays(remember ? _jwt.RefreshTokenDays : 1),
        });

        if (rotating is not null)
        {
            rotating.RevokedAtUtc = DateTime.UtcNow;
            rotating.ReplacedByTokenHash = Hash(refresh);
        }

        // One save covers the new token, the rotation and any login bookkeeping.
        await db.SaveChangesAsync(ct);

        return new TokenResponse(
            new JwtSecurityTokenHandler().WriteToken(jwt),
            refresh,
            expires,
            ToDto(user));
    }

    private static UserDto ToDto(User user)
    {
        var employee = user.Employee;
        return new UserDto(
            user.Id,
            user.UserName,
            user.Email,
            user.Role.ToString(),
            employee is null ? user.UserName : $"{employee.FirstName} {employee.LastName}".Trim(),
            employee?.Id,
            employee?.ProfileImagePath is null ? null : $"/api/employees/{employee.Id}/profile-image",
            user.MustChangePassword);
    }

    private async Task RevokeAllAsync(int userId, CancellationToken ct) =>
        await db.RefreshTokens
            .Where(x => x.UserId == userId && x.RevokedAtUtc == null)
            .ExecuteUpdateAsync(x => x.SetProperty(y => y.RevokedAtUtc, DateTime.UtcNow), ct);

    private static string NewToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));

    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
}
