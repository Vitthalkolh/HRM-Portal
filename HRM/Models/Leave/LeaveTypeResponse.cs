namespace HRM.API.Models.Leave
{
    public class LeaveTypeResponse
    {
        public int Id { get; set; }
        public string Code { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public decimal DefaultEntitlement { get; set; }
        public bool IsPaid { get; set; }
        public bool AllowHalfDay { get; set; }
        public bool IsBalanceTracked { get; set; }
        public bool IsApplicable { get; set; }
        public string? ColorCode { get; set; }
        public int DisplayOrder { get; set; }
        public bool IsActive { get; set; }
    }
}
