namespace HRM.API.Models
{
    public class EmployeeCalendarResponse
    {
        public DateTime CalendarDate { get; set; }

        /// <summary>LEAVE, HOLIDAY or OPTIONAL_HOLIDAY.</summary>
        public string EventType { get; set; } = string.Empty;

        public int? UserId { get; set; }
        public string? EmployeeName { get; set; }
        public string? EmployeeCode { get; set; }
        public string? HolidayName { get; set; }
        public int? LeaveTypeId { get; set; }
        public string? LeaveTypeName { get; set; }
        public string? ColorCode { get; set; }
        public int? StatusId { get; set; }
        public string? StatusName { get; set; }
        public bool IsHalfDay { get; set; }
        public int? HalfDaySession { get; set; }
    }
}
