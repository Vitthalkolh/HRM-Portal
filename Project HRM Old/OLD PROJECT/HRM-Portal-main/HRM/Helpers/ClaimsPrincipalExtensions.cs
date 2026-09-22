using System.Security.Claims;

namespace HRM.API.Helpers
{
    /// <summary>
    /// Reads the signed-in user out of the JWT. Replaces the hardcoded
    /// user ids the controllers previously used.
    /// </summary>
    public static class ClaimsPrincipalExtensions
    {
        public const string AdminRole = "Admin";
        public const string EmployeeRole = "Employee";

        public static int GetUserId(this ClaimsPrincipal principal)
        {
            string? value = principal.FindFirstValue(ClaimTypes.NameIdentifier);

            return int.TryParse(value, out int userId) ? userId : 0;
        }

        public static bool IsAdmin(this ClaimsPrincipal principal)
        {
            return principal.IsInRole(AdminRole);
        }
    }
}
