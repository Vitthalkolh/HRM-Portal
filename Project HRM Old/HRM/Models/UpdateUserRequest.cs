using System.ComponentModel.DataAnnotations;

namespace HRM.API.Models
{
    public class UpdateUserRequest
    {
        public string? EmployeeCode { get; set; }

        [Required]
        public string FirstName { get; set; } = string.Empty;

        [Required]
        public string LastName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        public string? MobileNo { get; set; }
        public string? City { get; set; }
        public string? Designation { get; set; }
        public string? Department { get; set; }
        public int? ReportingManagerId { get; set; }
        public DateTime? DateOfBirth { get; set; }

        [Required]
        public DateTime JoiningDate { get; set; }

        public DateTime? CompanyLeavingDate { get; set; }
        public bool IsAdmin { get; set; }
        public bool IsActive { get; set; }
    }
}
