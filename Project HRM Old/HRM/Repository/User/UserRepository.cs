using HRM.API.Helpers;
using HRM.API.Models;
using Microsoft.Data.SqlClient;

namespace HRM.API.Repository
{
    public class UserRepository : IUserRepository
    {
        private readonly AdoHelper _adoHelper;

        public UserRepository(AdoHelper adoHelper)
        {
            _adoHelper = adoHelper;
        }

        public LoginResponse? GetByUsername(string username)
        {
            using SqlConnection connection = _adoHelper.GetConnection();

            using SqlCommand command = _adoHelper.CreateStoredProcedureCommand(
                connection,
                "SP_USER_LOGIN",
                new SqlParameter("@USERNAME", username));

            using SqlDataReader reader = _adoHelper.ExecuteReader(command);

            if (!reader.Read())
            {
                return null;
            }

            return new LoginResponse
            {
                Id           = reader.GetInt("ID"),
                Username     = reader.GetStringOrEmpty("USERNAME"),
                PasswordHash = reader.GetStringOrEmpty("PASSWORD_HASH"),
                FirstName    = reader.GetStringOrEmpty("FIRST_NAME"),
                LastName     = reader.GetStringOrEmpty("LAST_NAME"),
                Email        = reader.GetStringOrNull("EMAIL"),
                EmployeeCode = reader.GetStringOrNull("EMPLOYEE_CODE"),
                Designation  = reader.GetStringOrNull("DESIGNATION"),
                Department   = reader.GetStringOrNull("DEPARTMENT"),
                IsAdmin      = reader.GetBool("IS_ADMIN"),
                IsActive     = reader.GetBool("IS_ACTIVE")
            };
        }

        public List<UserResponse> GetAllUsers(bool includeInactive)
        {
            List<UserResponse> users = new List<UserResponse>();

            using SqlConnection connection = _adoHelper.GetConnection();

            using SqlCommand command = _adoHelper.CreateStoredProcedureCommand(
                connection,
                "SP_GET_USERS",
                new SqlParameter("@INCLUDE_INACTIVE", includeInactive));

            using SqlDataReader reader = _adoHelper.ExecuteReader(command);

            while (reader.Read())
            {
                users.Add(MapUser(reader));
            }

            return users;
        }

        public UserResponse? GetUserById(int id)
        {
            using SqlConnection connection = _adoHelper.GetConnection();

            using SqlCommand command = _adoHelper.CreateStoredProcedureCommand(
                connection,
                "SP_GET_USER_BY_ID",
                new SqlParameter("@ID", id));

            using SqlDataReader reader = _adoHelper.ExecuteReader(command);

            return reader.Read() ? MapUser(reader) : null;
        }

        public int CreateUser(CreateUserRequest request, string passwordHash, int createdBy)
        {
            using SqlConnection connection = _adoHelper.GetConnection();

            using SqlCommand command = _adoHelper.CreateStoredProcedureCommand(
                connection,
                "SP_CREATE_USER",
                new SqlParameter("@USERNAME", request.Username),
                new SqlParameter("@PASSWORD_HASH", passwordHash),
                AdoHelper.Parameter("@EMPLOYEE_CODE", request.EmployeeCode),
                new SqlParameter("@FIRST_NAME", request.FirstName),
                new SqlParameter("@LAST_NAME", request.LastName),
                new SqlParameter("@EMAIL", request.Email),
                AdoHelper.Parameter("@MOBILE_NO", request.MobileNo),
                AdoHelper.Parameter("@CITY", request.City),
                AdoHelper.Parameter("@DESIGNATION", request.Designation),
                AdoHelper.Parameter("@DEPARTMENT", request.Department),
                AdoHelper.Parameter("@REPORTING_MANAGER_ID", request.ReportingManagerId),
                AdoHelper.Parameter("@DATE_OF_BIRTH", request.DateOfBirth),
                new SqlParameter("@JOINING_DATE", request.JoiningDate),
                AdoHelper.Parameter("@COMPANY_LEAVING_DATE", request.CompanyLeavingDate),
                new SqlParameter("@IS_ADMIN", request.IsAdmin),
                new SqlParameter("@IS_ACTIVE", request.IsActive),
                new SqlParameter("@CREATED_BY", createdBy));

            return _adoHelper.ExecuteScalarInt(command);
        }

        public int UpdateUser(int id, UpdateUserRequest request, int changedBy)
        {
            using SqlConnection connection = _adoHelper.GetConnection();

            using SqlCommand command = _adoHelper.CreateStoredProcedureCommand(
                connection,
                "SP_UPDATE_USER",
                new SqlParameter("@ID", id),
                AdoHelper.Parameter("@EMPLOYEE_CODE", request.EmployeeCode),
                new SqlParameter("@FIRST_NAME", request.FirstName),
                new SqlParameter("@LAST_NAME", request.LastName),
                new SqlParameter("@EMAIL", request.Email),
                AdoHelper.Parameter("@MOBILE_NO", request.MobileNo),
                AdoHelper.Parameter("@CITY", request.City),
                AdoHelper.Parameter("@DESIGNATION", request.Designation),
                AdoHelper.Parameter("@DEPARTMENT", request.Department),
                AdoHelper.Parameter("@REPORTING_MANAGER_ID", request.ReportingManagerId),
                AdoHelper.Parameter("@DATE_OF_BIRTH", request.DateOfBirth),
                new SqlParameter("@JOINING_DATE", request.JoiningDate),
                AdoHelper.Parameter("@COMPANY_LEAVING_DATE", request.CompanyLeavingDate),
                new SqlParameter("@IS_ADMIN", request.IsAdmin),
                new SqlParameter("@IS_ACTIVE", request.IsActive),
                new SqlParameter("@CHANGED_BY", changedBy));

            return _adoHelper.ExecuteScalarInt(command);
        }

        public int DeleteUser(int id, int changedBy)
        {
            using SqlConnection connection = _adoHelper.GetConnection();

            using SqlCommand command = _adoHelper.CreateStoredProcedureCommand(
                connection,
                "SP_DELETE_USER",
                new SqlParameter("@ID", id),
                new SqlParameter("@CHANGED_BY", changedBy));

            return _adoHelper.ExecuteScalarInt(command);
        }

        public int ChangePassword(int id, string passwordHash, int changedBy)
        {
            using SqlConnection connection = _adoHelper.GetConnection();

            using SqlCommand command = _adoHelper.CreateStoredProcedureCommand(
                connection,
                "SP_CHANGE_PASSWORD",
                new SqlParameter("@ID", id),
                new SqlParameter("@PASSWORD_HASH", passwordHash),
                new SqlParameter("@CHANGED_BY", changedBy));

            return _adoHelper.ExecuteScalarInt(command);
        }

        private static UserResponse MapUser(SqlDataReader reader)
        {
            return new UserResponse
            {
                Id                   = reader.GetInt("ID"),
                Username             = reader.GetStringOrEmpty("USERNAME"),
                EmployeeCode         = reader.GetStringOrNull("EMPLOYEE_CODE"),
                FirstName            = reader.GetStringOrEmpty("FIRST_NAME"),
                LastName             = reader.GetStringOrEmpty("LAST_NAME"),
                Email                = reader.GetStringOrEmpty("EMAIL"),
                MobileNo             = reader.GetStringOrNull("MOBILE_NO"),
                City                 = reader.GetStringOrNull("CITY"),
                Designation          = reader.GetStringOrNull("DESIGNATION"),
                Department           = reader.GetStringOrNull("DEPARTMENT"),
                ReportingManagerId   = reader.GetIntOrNull("REPORTING_MANAGER_ID"),
                ReportingManagerName = reader.GetStringOrNull("REPORTING_MANAGER_NAME"),
                DateOfBirth          = reader.GetDateTimeOrNull("DATE_OF_BIRTH"),
                JoiningDate          = reader.GetDateTime("JOINING_DATE"),
                CompanyLeavingDate   = reader.GetDateTimeOrNull("COMPANY_LEAVING_DATE"),
                IsAdmin              = reader.GetBool("IS_ADMIN"),
                IsActive             = reader.GetBool("IS_ACTIVE"),
                CreatedDate          = reader.GetDateTime("CREATED_DATE")
            };
        }
    }
}
