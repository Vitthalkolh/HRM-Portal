namespace HRM.API.Models.Dashboard
{
    /// <summary>A birthday or work anniversary falling in the lookahead window.</summary>
    public class EmployeeEventResponse
    {
        public int UserId { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public string? EmployeeCode { get; set; }
        public string? Email { get; set; }
        public string? Designation { get; set; }
        public string? Department { get; set; }
        public DateTime? DateOfBirth { get; set; }
        public DateTime? JoiningDate { get; set; }
        public DateTime EventDate { get; set; }
        public int DaysAway { get; set; }
        public int? YearsCompleted { get; set; }
    }
}
