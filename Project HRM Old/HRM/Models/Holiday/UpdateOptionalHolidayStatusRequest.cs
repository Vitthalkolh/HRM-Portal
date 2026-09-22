using System.ComponentModel.DataAnnotations;

namespace HRM.API.Models.Holiday
{
    public class UpdateOptionalHolidayStatusRequest
    {
        /// <summary>2 = Approve, 3 = Reject, 4 = Cancel.</summary>
        [Required]
        [Range(2, 4, ErrorMessage = "StatusId must be 2 (Approve), 3 (Reject) or 4 (Cancel).")]
        public int StatusId { get; set; }

        [MaxLength(500)]
        public string? RejectReason { get; set; }
    }
}
