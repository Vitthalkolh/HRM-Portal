using HRM.API.Models;

namespace HRM.API.Repository
{
    public interface IUserRepository
    {
        /// <summary>Loads the user by username including the stored hash, or null.</summary>
        LoginResponse? GetByUsername(string username);

        List<UserResponse> GetAllUsers(bool includeInactive);
        UserResponse? GetUserById(int id);
        int CreateUser(CreateUserRequest request, string passwordHash, int createdBy);
        int UpdateUser(int id, UpdateUserRequest request, int changedBy);
        int DeleteUser(int id, int changedBy);
        int ChangePassword(int id, string passwordHash, int changedBy);
    }
}
