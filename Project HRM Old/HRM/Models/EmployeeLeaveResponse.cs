namespace HRM.API.Models
{
    public class EmployeeLeaveResponse
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public string? EmployeeCode { get; set; }

        /// <summary>Populated only by the single-leave lookup; used for notifications.</summary>
        public string? EmployeeEmail { get; set; }
        public int LeaveTypeId { get; set; }
        public string LeaveTypeName { get; set; } = string.Empty;
        public string? ColorCode { get; set; }
        public DateTime FromDate { get; set; }
        public DateTime ToDate { get; set; }
        public bool IsHalfDay { get; set; }
        public int? HalfDaySession { get; set; }
        public string? HalfDaySessionName =>
            HalfDaySession == 1 ? "First Half"
            : HalfDaySession == 2 ? "Second Half"
            : null;
        public decimal TotalDays { get; set; }
        public string? Reason { get; set; }
        public int StatusId { get; set; }
        public string StatusName { get; set; } = string.Empty;
        public int? ApprovedBy { get; set; }
        public string? ApprovedByName { get; set; }
        public DateTime? ApprovedDate { get; set; }
        public string? RejectReason { get; set; }
        public int? CancelledBy { get; set; }
        public DateTime? CancelledDate { get; set; }
        public DateTime CreatedDate { get; set; }
    }
}
