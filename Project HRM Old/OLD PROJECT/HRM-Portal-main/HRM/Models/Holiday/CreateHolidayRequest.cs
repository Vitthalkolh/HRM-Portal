using System.ComponentModel.DataAnnotations;

namespace HRM.API.Models.Holiday
{
    public class CreateHolidayRequest
    {
        [Required]
        public DateTime HolidayDate { get; set; }

        [Required]
        public int LeaveTypeId { get; set; }

        [Required]
        [MaxLength(150)]
        public string Name { get; set; } = string.Empty;

        /// <summary>True for floater holidays employees opt into.</summary>
        public bool IsOptional { get; set; }
    }
}
