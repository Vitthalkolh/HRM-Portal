using HRM.API.Helpers;
using HRM.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRM.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class DashboardController : ControllerBase
    {
        private readonly IDashboardService _dashboardService;

        public DashboardController(IDashboardService dashboardService)
        {
            _dashboardService = dashboardService;
        }

        [HttpGet("summary")]
        public IActionResult GetSummary()
        {
            return Ok(_dashboardService.GetDashboardSummary(User.GetUserId(), User.IsAdmin()));
        }

        /// <summary>Birthdays falling within the next <paramref name="days"/> days.</summary>
        [HttpGet("birthdays")]
        public IActionResult GetBirthdays([FromQuery] int days = 30)
        {
            return Ok(_dashboardService.GetUpcomingBirthdays(NormaliseDays(days)));
        }

        /// <summary>Work anniversaries in the same window.</summary>
        [HttpGet("anniversaries")]
        public IActionResult GetAnniversaries([FromQuery] int days = 30)
        {
            return Ok(_dashboardService.GetWorkAnniversaries(NormaliseDays(days)));
        }

        private static int NormaliseDays(int days)
        {
            return days < 1 ? 1 : days > 365 ? 365 : days;
        }
    }
}
