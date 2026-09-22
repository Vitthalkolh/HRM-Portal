namespace HRM.API.Models
{
    public class UserResponse
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string? EmployeeCode { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string FullName => $"{FirstName} {LastName}".Trim();
        public string Email { get; set; } = string.Empty;
        public string? MobileNo { get; set; }
        public string? City { get; set; }
        public string? Designation { get; set; }
        public string? Department { get; set; }
        public int? ReportingManagerId { get; set; }
        public string? ReportingManagerName { get; set; }
        public DateTime? DateOfBirth { get; set; }
        public DateTime JoiningDate { get; set; }
        public DateTime? CompanyLeavingDate { get; set; }
        public bool IsAdmin { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedDate { get; set; }
    }
}
