using HRM.API.Helpers;
using HRM.API.Models.Common;
using HRM.API.Models.Holiday;
using HRM.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRM.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class HolidayController : ControllerBase
    {
        private readonly IHolidayService _holidayService;

        public HolidayController(IHolidayService holidayService)
        {
            _holidayService = holidayService;
        }

        /// <summary>
        /// The holiday list. isOptional=false gives national holidays,
        /// isOptional=true the floater list, omitted gives both.
        /// </summary>
        [HttpGet]
        public IActionResult GetCompanyHolidays(
            [FromQuery] int? year,
            [FromQuery] bool? isOptional)
        {
            return Ok(_holidayService.GetCompanyHolidays(year ?? DateTime.Today.Year, isOptional));
        }

        [HttpPost]
        [Authorize(Roles = ClaimsPrincipalExtensions.AdminRole)]
        public IActionResult CreateHoliday(CreateHolidayRequest request)
        {
            int holidayId = _holidayService.CreateCompanyHoliday(request, User.GetUserId());

            if (holidayId < 0)
            {
                return BadRequest(new { Message = OperationMessages.ForHoliday(holidayId) });
            }

            return Ok(new { Id = holidayId, Message = "Holiday created successfully." });
        }

        [HttpDelete("{id:int}")]
        [Authorize(Roles = ClaimsPrincipalExtensions.AdminRole)]
        public IActionResult DeleteHoliday(int id)
        {
            int result = _holidayService.DeleteCompanyHoliday(id, User.GetUserId());

            if (result < 0)
            {
                return NotFound(new { Message = "Holiday not found." });
            }

            return Ok(new { Id = result, Message = "Holiday removed successfully." });
        }

        /*---------------------------------------------------------------------
          Optional (floater) holidays
        ---------------------------------------------------------------------*/

        /// <summary>Opts the signed-in employee into an optional holiday.</summary>
        [HttpPost("optional")]
        public IActionResult ApplyOptionalHoliday(ApplyOptionalHolidayRequest request)
        {
            int userId = User.GetUserId();

            int requestId = _holidayService.ApplyOptionalHoliday(
                userId,
                request.HolidayId,
                userId);

            if (requestId < 0)
            {
                return BadRequest(new { Message = OperationMessages.ForOptionalHoliday(requestId) });
            }

            return Ok(new { Id = requestId, Message = "Optional holiday applied successfully." });
        }

        /// <summary>Admins see all opt-ins; employees see only their own.</summary>
        [HttpGet("optional")]
        public IActionResult GetOptionalHolidayRequests(
            [FromQuery] int? userId,
            [FromQuery] int? statusId)
        {
            int? effectiveUserId = User.IsAdmin() ? userId : User.GetUserId();

            return Ok(_holidayService.GetOptionalHolidayRequests(effectiveUserId, statusId));
        }

        /// <summary>Approve (2) or reject (3) an opt-in. Admin only.</summary>
        [HttpPut("optional/status/{id:int}")]
        [Authorize(Roles = ClaimsPrincipalExtensions.AdminRole)]
        public IActionResult UpdateOptionalHolidayStatus(
            int id,
            UpdateOptionalHolidayStatusRequest request)
        {
            int result = _holidayService.UpdateOptionalHolidayStatus(
                id,
                request.StatusId,
                User.GetUserId(),
                request.RejectReason);

            if (result < 0)
            {
                return BadRequest(new
                {
                    Message = OperationMessages.ForOptionalHolidayStatus(result)
                });
            }

            return Ok(new { Id = result, Message = "Optional holiday request updated." });
        }

        /// <summary>Lets an employee withdraw their own pending opt-in.</summary>
        [HttpDelete("optional/{id:int}")]
        public IActionResult CancelOptionalHoliday(int id)
        {
            const int statusCancelled = 4;

            if (!User.IsAdmin())
            {
                OptionalHolidayRequestResponse? owned = _holidayService
                    .GetOptionalHolidayRequests(User.GetUserId(), statusId: null)
                    .FirstOrDefault(r => r.Id == id);

                if (owned == null)
                {
                    return NotFound(new { Message = "Optional holiday request not found." });
                }
            }

            int result = _holidayService.UpdateOptionalHolidayStatus(
                id,
                statusCancelled,
                User.GetUserId(),
                rejectReason: null);

            if (result < 0)
            {
                return BadRequest(new
                {
                    Message = OperationMessages.ForOptionalHolidayStatus(result)
                });
            }

            return Ok(new { Id = result, Message = "Optional holiday cancelled." });
        }
    }
}
