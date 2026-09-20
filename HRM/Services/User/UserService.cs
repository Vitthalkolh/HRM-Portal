using HRM.API.Helpers;
using HRM.API.Models;
using HRM.API.Models.Auth;
using HRM.API.Repository;
using HRM.API.Services.Token;

namespace HRM.API.Services
{
    public class UserService : IUserService
    {
        private readonly IUserRepository _userRepository;
        private readonly ILeaveRepository _leaveRepository;
        private readonly ITokenService _tokenService;
        private readonly ILogger<UserService> _logger;

        public UserService(
            IUserRepository userRepository,
            ILeaveRepository leaveRepository,
            ITokenService tokenService,
            ILogger<UserService> logger)
        {
            _userRepository = userRepository;
            _leaveRepository = leaveRepository;
            _tokenService = tokenService;
            _logger = logger;
        }

        public AuthResponse? Login(string username, string password)
        {
            LoginResponse? user = _userRepository.GetByUsername(username);

            if (user == null)
            {
                return null;
            }

            if (!PasswordHasher.Verify(password, user.PasswordHash))
            {
                return null;
            }

            if (!user.IsActive)
            {
                _logger.LogWarning("Deactivated account attempted login: {Username}", username);

                return null;
            }

            (string token, DateTime expiresAt) = _tokenService.CreateToken(user);

            return new AuthResponse
            {
                Token        = token,
                ExpiresAt    = expiresAt,
                Id           = user.Id,
                Username     = user.Username,
                FullName     = $"{user.FirstName} {user.LastName}".Trim(),
                Email        = user.Email,
                EmployeeCode = user.EmployeeCode,
                Designation  = user.Designation,
                Department   = user.Department,
                IsAdmin      = user.IsAdmin
            };
        }

        public List<UserResponse> GetAllUsers(bool includeInactive)
        {
            return _userRepository.GetAllUsers(includeInactive);
        }

        public UserResponse? GetUserById(int id)
        {
            return _userRepository.GetUserById(id);
        }

        public int CreateUser(CreateUserRequest request, int createdBy)
        {
            string passwordHash = PasswordHasher.Hash(request.Password);

            int userId = _userRepository.CreateUser(request, passwordHash, createdBy);

            if (userId < 0)
            {
                return userId;
            }

            // A new joiner needs this year's quota before they can apply for anything.
            int year = request.JoiningDate.Year > DateTime.Today.Year
                ? request.JoiningDate.Year
                : DateTime.Today.Year;

            _leaveRepository.AllocateEmployeeLeave(userId, year, createdBy);

            return userId;
        }

        public int UpdateUser(int id, UpdateUserRequest request, int changedBy)
        {
            return _userRepository.UpdateUser(id, request, changedBy);
        }

        public int DeleteUser(int id, int changedBy)
        {
            return _userRepository.DeleteUser(id, changedBy);
        }

        public int ChangePassword(int userId, ChangePasswordRequest request)
        {
            UserResponse? user = _userRepository.GetUserById(userId);

            if (user == null)
            {
                return -1;
            }

            LoginResponse? stored = _userRepository.GetByUsername(user.Username);

            if (stored == null || !PasswordHasher.Verify(request.CurrentPassword, stored.PasswordHash))
            {
                return -2;
            }

            string newHash = PasswordHasher.Hash(request.NewPassword);

            return _userRepository.ChangePassword(userId, newHash, userId);
        }

        public int ResetPassword(int userId, string newPassword, int changedBy)
        {
            string newHash = PasswordHasher.Hash(newPassword);

            return _userRepository.ChangePassword(userId, newHash, changedBy);
        }
    }
}
