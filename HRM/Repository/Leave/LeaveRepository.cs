using HRM.API.Helpers;
using HRM.API.Models;
using HRM.API.Models.Leave;
using Microsoft.Data.SqlClient;

namespace HRM.API.Repository
{
    public class LeaveRepository : ILeaveRepository
    {
        private readonly AdoHelper _adoHelper;

        public LeaveRepository(AdoHelper adoHelper)
        {
            _adoHelper = adoHelper;
        }

        public List<LeaveTypeResponse> GetLeaveTypes(bool applicableOnly)
        {
            List<LeaveTypeResponse> types = new List<LeaveTypeResponse>();

            using SqlConnection connection = _adoHelper.GetConnection();

            using SqlCommand command = _adoHelper.CreateStoredProcedureCommand(
                connection,
                "SP_GET_LEAVE_TYPES",
                new SqlParameter("@APPLICABLE_ONLY", applicableOnly));

            using SqlDataReader reader = _adoHelper.ExecuteReader(command);

            while (reader.Read())
            {
                types.Add(new LeaveTypeResponse
                {
                    Id                 = reader.GetInt("ID"),
                    Code               = reader.GetStringOrEmpty("CODE"),
                    Name               = reader.GetStringOrEmpty("NAME"),
                    DefaultEntitlement = reader.GetDecimal("DEFAULT_ENTITLEMENT"),
                    IsPaid             = reader.GetBool("IS_PAID"),
                    AllowHalfDay       = reader.GetBool("ALLOW_HALF_DAY"),
                    IsBalanceTracked   = reader.GetBool("IS_BALANCE_TRACKED"),
                    IsApplicable       = reader.GetBool("IS_APPLICABLE"),
                    ColorCode          = reader.GetStringOrNull("COLOR_CODE"),
                    DisplayOrder       = reader.GetInt("DISPLAY_ORDER"),
                    IsActive           = reader.GetBool("IS_ACTIVE")
                });
            }

            return types;
        }

        public void AllocateEmployeeLeave(
            int userId,
            int year,
            int createdBy,
            int? leaveTypeId = null,
            decimal? entitlement = null)
        {
            using SqlConnection connection = _adoHelper.GetConnection();

            using SqlCommand command = _adoHelper.CreateStoredProcedureCommand(
                connection,
                "SP_ALLOCATE_EMPLOYEE_LEAVE",
                new SqlParameter("@USER_ID", userId),
                new SqlParameter("@YEAR", year),
                new SqlParameter("@CREATED_BY", createdBy),
                AdoHelper.Parameter("@LEAVE_TYPE_ID", leaveTypeId),
                AdoHelper.Parameter("@ENTITLEMENT", entitlement));

            _adoHelper.ExecuteScalar(command);
        }

        public int ApplyEmployeeLeave(int userId, ApplyLeaveRequest request, int createdBy)
        {
            byte? halfDaySession = request.IsHalfDay
                ? (byte)(request.HalfDaySession ?? 1)
                : (byte?)null;

            using SqlConnection connection = _adoHelper.GetConnection();

            using SqlCommand command = _adoHelper.CreateStoredProcedureCommand(
                connection,
                "SP_APPLY_EMPLOYEE_LEAVE",
                new SqlParameter("@USER_ID", userId),
                new SqlParameter("@LEAVE_TYPE_ID", request.LeaveTypeId),
                new SqlParameter("@FROM_DATE", request.FromDate.Date),
                new SqlParameter("@TO_DATE", request.ToDate.Date),
                new SqlParameter("@IS_HALF_DAY", request.IsHalfDay),
                AdoHelper.Parameter("@HALF_DAY_SESSION", halfDaySession),
                new SqlParameter("@REASON", request.Reason),
                new SqlParameter("@CREATED_BY", createdBy));

            return _adoHelper.ExecuteScalarInt(command);
        }

        public int UpdateEmployeeLeaveStatus(
            int id,
            int statusId,
            int changedBy,
            string? rejectReason)
        {
            using SqlConnection connection = _adoHelper.GetConnection();

            using SqlCommand command = _adoHelper.CreateStoredProcedureCommand(
                connection,
                "SP_UPDATE_EMPLOYEE_LEAVE_STATUS",
                new SqlParameter("@ID", id),
                new SqlParameter("@STATUS_ID", statusId),
                new SqlParameter("@CHANGED_BY", changedBy),
                AdoHelper.Parameter("@REJECT_REASON", rejectReason));

            return _adoHelper.ExecuteScalarInt(command);
        }

        public int CancelEmployeeLeave(int id, int cancelledBy)
        {
            using SqlConnection connection = _adoHelper.GetConnection();

            using SqlCommand command = _adoHelper.CreateStoredProcedureCommand(
                connection,
                "SP_CANCEL_EMPLOYEE_LEAVE",
                new SqlParameter("@ID", id),
                new SqlParameter("@CANCELLED_BY", cancelledBy));

            return _adoHelper.ExecuteScalarInt(command);
        }

        public List<EmployeeLeaveResponse> GetEmployeeLeaves(
            int? userId,
            int? statusId,
            DateTime? fromDate,
            DateTime? toDate)
        {
            List<EmployeeLeaveResponse> leaves = new List<EmployeeLeaveResponse>();

            using SqlConnection connection = _adoHelper.GetConnection();

            using SqlCommand command = _adoHelper.CreateStoredProcedureCommand(
                connection,
                "SP_GET_EMPLOYEE_LEAVES",
                AdoHelper.Parameter("@USER_ID", userId),
                AdoHelper.Parameter("@STATUS_ID", statusId),
                AdoHelper.Parameter("@FROM_DATE", fromDate?.Date),
                AdoHelper.Parameter("@TO_DATE", toDate?.Date));

            using SqlDataReader reader = _adoHelper.ExecuteReader(command);

            while (reader.Read())
            {
                leaves.Add(MapLeave(reader));
            }

            return leaves;
        }

        public EmployeeLeaveResponse? GetEmployeeLeaveById(int id)
        {
            using SqlConnection connection = _adoHelper.GetConnection();

            using SqlCommand command = _adoHelper.CreateStoredProcedureCommand(
                connection,
                "SP_GET_EMPLOYEE_LEAVE_BY_ID",
                new SqlParameter("@ID", id));

            using SqlDataReader reader = _adoHelper.ExecuteReader(command);

            if (!reader.Read())
            {
                return null;
            }

            EmployeeLeaveResponse leave = MapLeave(reader);

            leave.EmployeeEmail = reader.GetStringOrNull("EMPLOYEE_EMAIL");

            return leave;
        }

        public List<EmployeeLeaveBalanceResponse> GetEmployeeLeaveBalance(int userId, int year)
        {
            List<EmployeeLeaveBalanceResponse> balances =
                new List<EmployeeLeaveBalanceResponse>();

            using SqlConnection connection = _adoHelper.GetConnection();

            using SqlCommand command = _adoHelper.CreateStoredProcedureCommand(
                connection,
                "SP_GET_EMPLOYEE_LEAVE_BALANCE",
                new SqlParameter("@USER_ID", userId),
                new SqlParameter("@YEAR", year));

            using SqlDataReader reader = _adoHelper.ExecuteReader(command);

            while (reader.Read())
            {
                balances.Add(new EmployeeLeaveBalanceResponse
                {
                    LeaveTypeId      = reader.GetInt("LEAVE_TYPE_ID"),
                    LeaveTypeName    = reader.GetStringOrEmpty("LEAVE_TYPE_NAME"),
                    LeaveTypeCode    = reader.GetStringOrEmpty("LEAVE_TYPE_CODE"),
                    ColorCode        = reader.GetStringOrNull("COLOR_CODE"),
                    IsBalanceTracked = reader.GetBool("IS_BALANCE_TRACKED"),
                    Entitlement      = reader.GetDecimal("ENTITLEMENT"),
                    Used             = reader.GetDecimal("USED"),
                    Pending          = reader.GetDecimal("PENDING"),
                    Remaining        = reader.GetDecimal("REMAINING")
                });
            }

            return balances;
        }

        public List<EmployeeCalendarResponse> GetEmployeeCalendar(int year, int month, int? userId)
        {
            List<EmployeeCalendarResponse> calendar = new List<EmployeeCalendarResponse>();

            using SqlConnection connection = _adoHelper.GetConnection();

            using SqlCommand command = _adoHelper.CreateStoredProcedureCommand(
                connection,
                "SP_GET_EMPLOYEE_CALENDAR",
                new SqlParameter("@YEAR", year),
                new SqlParameter("@MONTH", month),
                AdoHelper.Parameter("@USER_ID", userId));

            using SqlDataReader reader = _adoHelper.ExecuteReader(command);

            while (reader.Read())
            {
                calendar.Add(new EmployeeCalendarResponse
                {
                    CalendarDate   = reader.GetDateTime("CALENDAR_DATE"),
                    EventType      = reader.GetStringOrEmpty("EVENT_TYPE"),
                    UserId         = reader.GetIntOrNull("USER_ID"),
                    EmployeeName   = reader.GetStringOrNull("EMPLOYEE_NAME"),
                    EmployeeCode   = reader.GetStringOrNull("EMPLOYEE_CODE"),
                    HolidayName    = reader.GetStringOrNull("HOLIDAY_NAME"),
                    LeaveTypeId    = reader.GetIntOrNull("LEAVE_TYPE_ID"),
                    LeaveTypeName  = reader.GetStringOrNull("LEAVE_TYPE_NAME"),
                    ColorCode      = reader.GetStringOrNull("COLOR_CODE"),
                    StatusId       = reader.GetIntOrNull("STATUS_ID"),
                    StatusName     = reader.GetStringOrNull("STATUS_NAME"),
                    IsHalfDay      = reader.GetBool("IS_HALF_DAY"),
                    HalfDaySession = reader.GetIntOrNull("HALF_DAY_SESSION")
                });
            }

            return calendar;
        }

        private static EmployeeLeaveResponse MapLeave(SqlDataReader reader)
        {
            return new EmployeeLeaveResponse
            {
                Id             = reader.GetInt("ID"),
                UserId         = reader.GetInt("USER_ID"),
                EmployeeName   = reader.GetStringOrEmpty("EMPLOYEE_NAME"),
                EmployeeCode   = reader.GetStringOrNull("EMPLOYEE_CODE"),
                LeaveTypeId    = reader.GetInt("LEAVE_TYPE_ID"),
                LeaveTypeName  = reader.GetStringOrEmpty("LEAVE_TYPE_NAME"),
                ColorCode      = reader.GetStringOrNull("COLOR_CODE"),
                FromDate       = reader.GetDateTime("FROM_DATE"),
                ToDate         = reader.GetDateTime("TO_DATE"),
                IsHalfDay      = reader.GetBool("IS_HALF_DAY"),
                HalfDaySession = reader.GetIntOrNull("HALF_DAY_SESSION"),
                TotalDays      = reader.GetDecimal("TOTAL_DAYS"),
                Reason         = reader.GetStringOrNull("REASON"),
                StatusId       = reader.GetInt("STATUS_ID"),
                StatusName     = reader.GetStringOrEmpty("STATUS_NAME"),
                ApprovedBy     = reader.GetIntOrNull("APPROVED_BY"),
                ApprovedByName = reader.GetStringOrNull("APPROVED_BY_NAME"),
                ApprovedDate   = reader.GetDateTimeOrNull("APPROVED_DATE"),
                RejectReason   = reader.GetStringOrNull("REJECT_REASON"),
                CancelledBy    = reader.GetIntOrNull("CANCELLED_BY"),
                CancelledDate  = reader.GetDateTimeOrNull("CANCELLED_DATE"),
                CreatedDate    = reader.GetDateTime("CREATED_DATE")
            };
        }
    }
}
