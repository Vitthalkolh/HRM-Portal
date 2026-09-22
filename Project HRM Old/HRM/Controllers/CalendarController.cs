using HRM.API.Helpers;
using HRM.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRM.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class CalendarController : ControllerBase
    {
        private readonly ILeaveService _leaveService;

        public CalendarController(ILeaveService leaveService)
        {
            _leaveService = leaveService;
        }

        /// <summary>
        /// Company-wide calendar: every employee's leave for the month plus
        /// holidays. This is what lets anyone see who is off on a given date.
        /// </summary>
        [HttpGet("company")]
        public IActionResult GetCompanyCalendar([FromQuery] int year, [FromQuery] int month)
        {
            IActionResult? invalid = ValidateMonth(year, month);

            if (invalid != null)
            {
                return invalid;
            }

            return Ok(_leaveService.GetEmployeeCalendar(year, month, userId: null));
        }

        /// <summary>The signed-in employee's own calendar for the month.</summary>
        [HttpGet("my")]
        public IActionResult GetMyCalendar([FromQuery] int year, [FromQuery] int month)
        {
            IActionResult? invalid = ValidateMonth(year, month);

            if (invalid != null)
            {
                return invalid;
            }

            return Ok(_leaveService.GetEmployeeCalendar(year, month, User.GetUserId()));
        }

        private IActionResult? ValidateMonth(int year, int month)
        {
            if (month < 1 || month > 12)
            {
                return BadRequest(new { Message = "Month must be between 1 and 12." });
            }

            int currentYear = DateTime.Today.Year;

            if (year < currentYear - 15 || year > currentYear + 2)
            {
                return BadRequest(new
                {
                    Message = $"Year must be between {currentYear - 15} and {currentYear + 2}."
                });
            }

            return null;
        }
    }
}
