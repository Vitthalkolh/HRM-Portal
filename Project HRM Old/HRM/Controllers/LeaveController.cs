using HRM.API.Helpers;
using HRM.API.Models;
using HRM.API.Models.Common;
using HRM.API.Models.Leave;
using HRM.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRM.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class LeaveController : ControllerBase
    {
        private const int StatusPending = 1;
        private const int StatusApproved = 2;

        private readonly ILeaveService _leaveService;

        public LeaveController(ILeaveService leaveService)
        {
            _leaveService = leaveService;
        }

        [HttpGet("types")]
        public IActionResult GetLeaveTypes([FromQuery] bool applicableOnly = true)
        {
            return Ok(_leaveService.GetLeaveTypes(applicableOnly));
        }

        /// <summary>
        /// Applies for leave on behalf of the signed-in employee. Single day,
        /// multi-day and half-day are all the same call: a half day is
        /// FromDate == ToDate with IsHalfDay set.
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> ApplyLeave(ApplyLeaveRequest request)
        {
            int userId = User.GetUserId();

            int leaveId = await _leaveService.ApplyEmployeeLeaveAsync(userId, request, userId);

            if (leaveId < 0)
            {
                return BadRequest(new { Message = OperationMessages.ForApplyLeave(leaveId) });
            }

            return Ok(new { Id = leaveId, Message = "Leave applied successfully." });
        }

        /// <summary>
        /// Admins see every request; an employee only ever sees their own,
        /// whatever userId they ask for.
        /// </summary>
        [HttpGet]
        public IActionResult GetEmployeeLeaves(
            [FromQuery] int? userId,
            [FromQuery] int? statusId,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate)
        {
            int? effectiveUserId = User.IsAdmin() ? userId : User.GetUserId();

            return Ok(_leaveService.GetEmployeeLeaves(effectiveUserId, statusId, fromDate, toDate));
        }

        [HttpGet("{id:int}")]
        public IActionResult GetLeaveById(int id)
        {
            EmployeeLeaveResponse? leave = _leaveService.GetEmployeeLeaveById(id);

            if (leave == null)
            {
                return NotFound(new { Message = "Leave request not found." });
            }

            if (!User.IsAdmin() && leave.UserId != User.GetUserId())
            {
                return Forbid();
            }

            return Ok(leave);
        }

        /// <summary>Approve (StatusId 2) or reject (StatusId 3). Admin only.</summary>
        [HttpPut("status/{id:int}")]
        [Authorize(Roles = ClaimsPrincipalExtensions.AdminRole)]
        public async Task<IActionResult> UpdateLeaveStatus(
            int id,
            UpdateLeaveStatusRequest request)
        {
            int result = await _leaveService.UpdateEmployeeLeaveStatusAsync(
                id,
                request.StatusId,
                User.GetUserId(),
                request.RejectReason);

            if (result < 0)
            {
                return BadRequest(new { Message = OperationMessages.ForLeaveStatus(result) });
            }

            string message = request.StatusId == StatusApproved
                ? "Leave approved successfully."
                : "Leave rejected successfully.";

            return Ok(new { Id = result, Message = message });
        }

        /// <summary>
        /// Cancels a leave. An admin may cancel anyone's pending or already
        /// approved leave; an employee may only withdraw their own request
        /// while it is still pending.
        /// </summary>
        [HttpPut("cancel/{id:int}")]
        public async Task<IActionResult> CancelLeave(int id)
        {
            EmployeeLeaveResponse? leave = _leaveService.GetEmployeeLeaveById(id);

            if (leave == null)
            {
                return NotFound(new { Message = "Leave request not found." });
            }

            if (!User.IsAdmin())
            {
                if (leave.UserId != User.GetUserId())
                {
                    return Forbid();
                }

                if (leave.StatusId != StatusPending)
                {
                    return BadRequest(new
                    {
                        Message = "An approved leave can only be cancelled by an administrator."
                    });
                }
            }

            int result = await _leaveService.CancelEmployeeLeaveAsync(id, User.GetUserId());

            if (result < 0)
            {
                return BadRequest(new { Message = OperationMessages.ForCancelLeave(result) });
            }

            return Ok(new { Id = result, Message = "Leave cancelled successfully." });
        }

        [HttpGet("balance")]
        public IActionResult GetEmployeeLeaveBalance(
            [FromQuery] int? userId,
            [FromQuery] int? year)
        {
            int effectiveUserId = User.IsAdmin() && userId.HasValue
                ? userId.Value
                : User.GetUserId();

            return Ok(_leaveService.GetEmployeeLeaveBalance(
                effectiveUserId,
                year ?? DateTime.Today.Year));
        }

        /// <summary>
        /// Allocates or overrides a yearly quota. Admin only.
        /// </summary>
        [HttpPost("allocate")]
        [Authorize(Roles = ClaimsPrincipalExtensions.AdminRole)]
        public IActionResult AllocateLeave(
            [FromQuery] int userId,
            [FromQuery] int year,
            [FromQuery] int? leaveTypeId,
            [FromQuery] decimal? entitlement)
        {
            _leaveService.AllocateEmployeeLeave(
                userId,
                year,
                User.GetUserId(),
                leaveTypeId,
                entitlement);

            return Ok(new { Message = "Leave balance allocated successfully." });
        }
    }
}
