using HRM.API.Helpers;
using HRM.API.Models;
using HRM.API.Models.Auth;
using HRM.API.Models.Common;
using HRM.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRM.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly IUserService _userService;

        public UsersController(IUserService userService)
        {
            _userService = userService;
        }

        /// <summary>
        /// Every signed-in user can see the employee directory; only admins see
        /// deactivated employees.
        /// </summary>
        [HttpGet]
        public IActionResult GetAllUsers([FromQuery] bool includeInactive = false)
        {
            bool showInactive = includeInactive && User.IsAdmin();

            return Ok(_userService.GetAllUsers(showInactive));
        }

        [HttpGet("{id:int}")]
        public IActionResult GetUserById(int id)
        {
            // An employee may only read their own record; admins read anyone's.
            if (!User.IsAdmin() && User.GetUserId() != id)
            {
                return Forbid();
            }

            UserResponse? user = _userService.GetUserById(id);

            if (user == null)
            {
                return NotFound(new { Message = "Employee not found." });
            }

            return Ok(user);
        }

        [HttpPost]
        [Authorize(Roles = ClaimsPrincipalExtensions.AdminRole)]
        public IActionResult CreateUser(CreateUserRequest request)
        {
            int userId = _userService.CreateUser(request, User.GetUserId());

            if (userId < 0)
            {
                return BadRequest(new { Message = OperationMessages.ForCreateUser(userId) });
            }

            return Ok(new { Id = userId, Message = "Employee created successfully." });
        }

        [HttpPut("{id:int}")]
        [Authorize(Roles = ClaimsPrincipalExtensions.AdminRole)]
        public IActionResult UpdateUser(int id, UpdateUserRequest request)
        {
            int result = _userService.UpdateUser(id, request, User.GetUserId());

            if (result == -1)
            {
                return NotFound(new { Message = OperationMessages.ForUpdateUser(result) });
            }

            if (result < 0)
            {
                return BadRequest(new { Message = OperationMessages.ForUpdateUser(result) });
            }

            return Ok(new { Id = result, Message = "Employee updated successfully." });
        }

        /// <summary>Deactivates the employee; the record and its history are kept.</summary>
        [HttpDelete("{id:int}")]
        [Authorize(Roles = ClaimsPrincipalExtensions.AdminRole)]
        public IActionResult DeleteUser(int id)
        {
            if (id == User.GetUserId())
            {
                return BadRequest(new { Message = "You cannot deactivate your own account." });
            }

            int result = _userService.DeleteUser(id, User.GetUserId());

            if (result == -1)
            {
                return NotFound(new { Message = "Employee not found, or already inactive." });
            }

            return Ok(new { Id = result, Message = "Employee deactivated successfully." });
        }

        [HttpPost("{id:int}/reset-password")]
        [Authorize(Roles = ClaimsPrincipalExtensions.AdminRole)]
        public IActionResult ResetPassword(int id, ResetPasswordRequest request)
        {
            int result = _userService.ResetPassword(id, request.NewPassword, User.GetUserId());

            if (result == -1)
            {
                return NotFound(new { Message = "Employee not found." });
            }

            return Ok(new { Id = result, Message = "Password reset successfully." });
        }
    }
}
