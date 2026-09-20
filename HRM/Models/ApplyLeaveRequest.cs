using System.ComponentModel.DataAnnotations;

namespace HRM.API.Models
{
    public class ApplyLeaveRequest
    {
        [Required]
        public int LeaveTypeId { get; set; }

        [Required]
        public DateTime FromDate { get; set; }

        [Required]
        public DateTime ToDate { get; set; }

        public bool IsHalfDay { get; set; }

        /// <summary>1 = First Half, 2 = Second Half. Ignored unless IsHalfDay.</summary>
        public int? HalfDaySession { get; set; }

        [Required]
        [MaxLength(500)]
        public string Reason { get; set; } = string.Empty;
    }
}
