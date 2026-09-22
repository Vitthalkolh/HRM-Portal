using HRM.API.Helpers;
using HRM.API.Models;
using HRM.API.Models.Auth;
using HRM.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRM.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IUserService _userService;
        private readonly ILogger<AuthController> _logger;

        public AuthController(IUserService userService, ILogger<AuthController> logger)
        {
            _userService = userService;
            _logger = logger;
        }

        /// <summary>
        /// Single endpoint for both portals. The returned token carries the
        /// Admin or Employee role, and the SPA routes on it.
        /// </summary>
        [HttpPost("login")]
        [AllowAnonymous]
        public IActionResult Login(LoginRequest request)
        {
            AuthResponse? auth = _userService.Login(request.UserName, request.Password);

            if (auth == null)
            {
                _logger.LogWarning("Failed login for {Username}", request.UserName);

                return Unauthorized(new { Message = "Invalid username or password." });
            }

            return Ok(auth);
        }

        /// <summary>The signed-in user's own profile.</summary>
        [HttpGet("me")]
        [Authorize]
        public IActionResult Me()
        {
            UserResponse? user = _userService.GetUserById(User.GetUserId());

            if (user == null)
            {
                return NotFound(new { Message = "Employee not found." });
            }

            return Ok(user);
        }

        [HttpPost("change-password")]
        [Authorize]
        public IActionResult ChangePassword(ChangePasswordRequest request)
        {
            int result = _userService.ChangePassword(User.GetUserId(), request);

            if (result == -1)
            {
                return NotFound(new { Message = "Employee not found." });
            }

            if (result == -2)
            {
                return BadRequest(new { Message = "Your current password is incorrect." });
            }

            return Ok(new { Message = "Password changed successfully." });
        }
    }
}
