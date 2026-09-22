using System.Security.Claims;

namespace HRM.Server.Infrastructure;

/// <summary>
/// Single place that reads identity claims. JwtBearer maps the inbound "sub" claim to
/// <see cref="ClaimTypes.NameIdentifier"/>, so both keys are checked rather than assuming one.
/// </summary>
public static class ClaimsPrincipalExtensions
{
    public static int UserId(this ClaimsPrincipal principal)
    {
        var raw = principal.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? principal.FindFirstValue("sub")
                  ?? principal.FindFirstValue("nameid");

        return int.TryParse(raw, out var id)
            ? id
            : throw new AppException(StatusCodes.Status401Unauthorized, "Your session is not valid. Please sign in again.");
    }

    public static bool IsAdmin(this ClaimsPrincipal principal) => principal.IsInRole("Admin");

    public static string UserName(this ClaimsPrincipal principal) =>
        principal.FindFirstValue(ClaimTypes.Name) ?? principal.FindFirstValue("unique_name") ?? "unknown";
}
