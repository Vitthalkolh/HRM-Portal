namespace HRM.API.Models.Dashboard
{
    public class DashboardSummaryResponse
    {
        public int PendingApprovals { get; set; }
        public int MyPendingRequests { get; set; }
        public decimal MyApprovedDays { get; set; }
        public int OnLeaveToday { get; set; }
        public int ActiveEmployees { get; set; }
        public DateTime? NextHolidayDate { get; set; }
        public string? NextHolidayName { get; set; }
    }
}
