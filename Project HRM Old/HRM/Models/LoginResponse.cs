namespace HRM.API.Models
{
    public class LoginResponse
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? EmployeeCode { get; set; }
        public string? Designation { get; set; }
        public string? Department { get; set; }
        public bool IsAdmin { get; set; }
        public bool IsActive { get; set; }

        /// <summary>Only populated internally during login; never returned to clients.</summary>
        public string PasswordHash { get; set; } = string.Empty;
    }
}
