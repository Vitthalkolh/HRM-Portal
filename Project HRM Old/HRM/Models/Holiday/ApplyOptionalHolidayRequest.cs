using System.ComponentModel.DataAnnotations;

namespace HRM.API.Models.Holiday
{
    public class ApplyOptionalHolidayRequest
    {
        [Required]
        public int HolidayId { get; set; }
    }
}
