using HRM.API.Models;
using HRM.API.Models.Auth;

namespace HRM.API.Services
{
    public interface IUserService
    {
        /// <summary>Returns a signed token on success, or null for bad credentials
        /// or a deactivated account.</summary>
        AuthResponse? Login(string username, string password);

        List<UserResponse> GetAllUsers(bool includeInactive);
        UserResponse? GetUserById(int id);
        int CreateUser(CreateUserRequest request, int createdBy);
        int UpdateUser(int id, UpdateUserRequest request, int changedBy);
        int DeleteUser(int id, int changedBy);

        /// <summary>Returns the user id, -1 if not found, -2 if the current
        /// password does not match.</summary>
        int ChangePassword(int userId, ChangePasswordRequest request);

        int ResetPassword(int userId, string newPassword, int changedBy);
    }
}
