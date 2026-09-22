using HRM.API.Helpers;
using HRM.API.Models;
using HRM.API.Models.Holiday;
using Microsoft.Data.SqlClient;

namespace HRM.API.Repository
{
    public class HolidayRepository : IHolidayRepository
    {
        private readonly AdoHelper _adoHelper;

        public HolidayRepository(AdoHelper adoHelper)
        {
            _adoHelper = adoHelper;
        }

        public int CreateCompanyHoliday(CreateHolidayRequest request, int createdBy)
        {
            using SqlConnection connection = _adoHelper.GetConnection();

            using SqlCommand command = _adoHelper.CreateStoredProcedureCommand(
                connection,
                "SP_CREATE_COMPANY_HOLIDAY",
                new SqlParameter("@HOLIDAY_DATE", request.HolidayDate.Date),
                new SqlParameter("@LEAVE_TYPE_ID", request.LeaveTypeId),
                new SqlParameter("@NAME", request.Name),
                new SqlParameter("@IS_OPTIONAL", request.IsOptional),
                new SqlParameter("@CREATED_BY", createdBy));

            return _adoHelper.ExecuteScalarInt(command);
        }

        public List<CompanyHolidayResponse> GetCompanyHolidays(int? year, bool? isOptional)
        {
            List<CompanyHolidayResponse> holidays = new List<CompanyHolidayResponse>();

            using SqlConnection connection = _adoHelper.GetConnection();

            using SqlCommand command = _adoHelper.CreateStoredProcedureCommand(
                connection,
                "SP_GET_COMPANY_HOLIDAYS",
                AdoHelper.Parameter("@YEAR", year),
                AdoHelper.Parameter("@IS_OPTIONAL", isOptional));

            using SqlDataReader reader = _adoHelper.ExecuteReader(command);

            while (reader.Read())
            {
                holidays.Add(new CompanyHolidayResponse
                {
                    Id            = reader.GetInt("ID"),
                    HolidayDate   = reader.GetDateTime("HOLIDAY_DATE"),
                    LeaveTypeId   = reader.GetInt("LEAVE_TYPE_ID"),
                    LeaveTypeName = reader.GetStringOrEmpty("LEAVE_TYPE_NAME"),
                    Name          = reader.GetStringOrEmpty("NAME"),
                    IsOptional    = reader.GetBool("IS_OPTIONAL"),
                    IsActive      = reader.GetBool("IS_ACTIVE")
                });
            }

            return holidays;
        }

        public int DeleteCompanyHoliday(int id, int changedBy)
        {
            using SqlConnection connection = _adoHelper.GetConnection();

            using SqlCommand command = _adoHelper.CreateStoredProcedureCommand(
                connection,
                "SP_DELETE_COMPANY_HOLIDAY",
                new SqlParameter("@ID", id),
                new SqlParameter("@CHANGED_BY", changedBy));

            return _adoHelper.ExecuteScalarInt(command);
        }

        public int ApplyOptionalHoliday(int userId, int holidayId, int createdBy)
        {
            using SqlConnection connection = _adoHelper.GetConnection();

            using SqlCommand command = _adoHelper.CreateStoredProcedureCommand(
                connection,
                "SP_APPLY_OPTIONAL_HOLIDAY",
                new SqlParameter("@USER_ID", userId),
                new SqlParameter("@HOLIDAY_ID", holidayId),
                new SqlParameter("@CREATED_BY", createdBy));

            return _adoHelper.ExecuteScalarInt(command);
        }

        public List<OptionalHolidayRequestResponse> GetOptionalHolidayRequests(
            int? userId,
            int? statusId)
        {
            List<OptionalHolidayRequestResponse> requests =
                new List<OptionalHolidayRequestResponse>();

            using SqlConnection connection = _adoHelper.GetConnection();

            using SqlCommand command = _adoHelper.CreateStoredProcedureCommand(
                connection,
                "SP_GET_OPTIONAL_HOLIDAY_REQUESTS",
                AdoHelper.Parameter("@USER_ID", userId),
                AdoHelper.Parameter("@STATUS_ID", statusId));

            using SqlDataReader reader = _adoHelper.ExecuteReader(command);

            while (reader.Read())
            {
                requests.Add(new OptionalHolidayRequestResponse
                {
                    Id             = reader.GetInt("ID"),
                    UserId         = reader.GetInt("USER_ID"),
                    EmployeeName   = reader.GetStringOrEmpty("EMPLOYEE_NAME"),
                    HolidayId      = reader.GetInt("HOLIDAY_ID"),
                    HolidayName    = reader.GetStringOrEmpty("HOLIDAY_NAME"),
                    HolidayDate    = reader.GetDateTime("HOLIDAY_DATE"),
                    StatusId       = reader.GetInt("STATUS_ID"),
                    StatusName     = reader.GetStringOrEmpty("STATUS_NAME"),
                    ApprovedBy     = reader.GetIntOrNull("APPROVED_BY"),
                    ApprovedByName = reader.GetStringOrNull("APPROVED_BY_NAME"),
                    ApprovedDate   = reader.GetDateTimeOrNull("APPROVED_DATE"),
                    RejectReason   = reader.GetStringOrNull("REJECT_REASON"),
                    CreatedDate    = reader.GetDateTime("CREATED_DATE")
                });
            }

            return requests;
        }

        public int UpdateOptionalHolidayStatus(
            int id,
            int statusId,
            int changedBy,
            string? rejectReason)
        {
            using SqlConnection connection = _adoHelper.GetConnection();

            using SqlCommand command = _adoHelper.CreateStoredProcedureCommand(
                connection,
                "SP_UPDATE_OPTIONAL_HOLIDAY_STATUS",
                new SqlParameter("@ID", id),
                new SqlParameter("@STATUS_ID", statusId),
                new SqlParameter("@CHANGED_BY", changedBy),
                AdoHelper.Parameter("@REJECT_REASON", rejectReason));

            return _adoHelper.ExecuteScalarInt(command);
        }
    }
}
