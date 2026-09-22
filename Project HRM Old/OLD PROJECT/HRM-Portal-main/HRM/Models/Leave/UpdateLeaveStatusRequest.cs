using System.ComponentModel.DataAnnotations;

namespace HRM.API.Models.Leave
{
    public class UpdateLeaveStatusRequest
    {
        /// <summary>2 = Approve, 3 = Reject.</summary>
        [Required]
        [Range(2, 3, ErrorMessage = "StatusId must be 2 (Approve) or 3 (Reject).")]
        public int StatusId { get; set; }

        [MaxLength(500)]
        public string? RejectReason { get; set; }
    }
}
