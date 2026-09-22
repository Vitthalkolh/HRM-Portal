namespace HRM.API.Models
{
    public class CompanyHolidayResponse
    {
        public int Id { get; set; }
        public DateTime HolidayDate { get; set; }
        public int LeaveTypeId { get; set; }
        public string LeaveTypeName { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public bool IsOptional { get; set; }
        public bool IsActive { get; set; }
    }
}
