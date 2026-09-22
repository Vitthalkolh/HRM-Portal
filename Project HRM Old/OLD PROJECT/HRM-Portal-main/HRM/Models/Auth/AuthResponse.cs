namespace HRM.API.Models.Auth
{
    public class AuthResponse
    {
        public string Token { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? EmployeeCode { get; set; }
        public string? Designation { get; set; }
        public string? Department { get; set; }
        public bool IsAdmin { get; set; }
        public string Role => IsAdmin ? "Admin" : "Employee";
    }
}
