namespace HRM.API.Models
{
    public class EmployeeLeaveBalanceResponse
    {
        public int LeaveTypeId { get; set; }
        public string LeaveTypeName { get; set; } = string.Empty;
        public string LeaveTypeCode { get; set; } = string.Empty;
        public string? ColorCode { get; set; }
        public bool IsBalanceTracked { get; set; }
        public decimal Entitlement { get; set; }
        public decimal Used { get; set; }
        public decimal Pending { get; set; }
        public decimal Remaining { get; set; }
    }
}
