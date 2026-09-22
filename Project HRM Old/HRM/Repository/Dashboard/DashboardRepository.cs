using HRM.API.Helpers;
using HRM.API.Models.Dashboard;
using HRM.API.Models.Email;
using Microsoft.Data.SqlClient;

namespace HRM.API.Repository
{
    public class DashboardRepository : IDashboardRepository
    {
        private readonly AdoHelper _adoHelper;

        public DashboardRepository(AdoHelper adoHelper)
        {
            _adoHelper = adoHelper;
        }

        public DashboardSummaryResponse GetDashboardSummary(int userId, bool isAdmin)
        {
            using SqlConnection connection = _adoHelper.GetConnection();

            using SqlCommand command = _adoHelper.CreateStoredProcedureCommand(
                connection,
                "SP_GET_DASHBOARD_SUMMARY",
                new SqlParameter("@USER_ID", userId),
                new SqlParameter("@IS_ADMIN", isAdmin));

            using SqlDataReader reader = _adoHelper.ExecuteReader(command);

            if (!reader.Read())
            {
                return new DashboardSummaryResponse();
            }

            return new DashboardSummaryResponse
            {
                PendingApprovals  = reader.GetInt("PENDING_APPROVALS"),
                MyPendingRequests = reader.GetInt("MY_PENDING_REQUESTS"),
                MyApprovedDays    = reader.GetDecimal("MY_APPROVED_DAYS"),
                OnLeaveToday      = reader.GetInt("ON_LEAVE_TODAY"),
                ActiveEmployees   = reader.GetInt("ACTIVE_EMPLOYEES"),
                NextHolidayDate   = reader.GetDateTimeOrNull("NEXT_HOLIDAY_DATE"),
                NextHolidayName   = reader.GetStringOrNull("NEXT_HOLIDAY_NAME")
            };
        }

        public List<EmployeeEventResponse> GetUpcomingBirthdays(int days)
        {
            return GetEvents("SP_GET_UPCOMING_BIRTHDAYS", days);
        }

        public List<EmployeeEventResponse> GetWorkAnniversaries(int days)
        {
            return GetEvents("SP_GET_WORK_ANNIVERSARIES", days);
        }

        private List<EmployeeEventResponse> GetEvents(string storedProcedure, int days)
        {
            List<EmployeeEventResponse> events = new List<EmployeeEventResponse>();

            using SqlConnection connection = _adoHelper.GetConnection();

            using SqlCommand command = _adoHelper.CreateStoredProcedureCommand(
                connection,
                storedProcedure,
                new SqlParameter("@DAYS", days));

            using SqlDataReader reader = _adoHelper.ExecuteReader(command);

            while (reader.Read())
            {
                events.Add(new EmployeeEventResponse
                {
                    UserId         = reader.GetInt("USER_ID"),
                    EmployeeName   = reader.GetStringOrEmpty("EMPLOYEE_NAME"),
                    EmployeeCode   = reader.GetStringOrNull("EMPLOYEE_CODE"),
                    Email          = reader.GetStringOrNull("EMAIL"),
                    Designation    = reader.GetStringOrNull("DESIGNATION"),
                    Department     = reader.GetStringOrNull("DEPARTMENT"),
                    DateOfBirth    = reader.GetDateTimeOrNull("DATE_OF_BIRTH"),
                    JoiningDate    = reader.GetDateTimeOrNull("JOINING_DATE"),
                    EventDate      = reader.GetDateTime("EVENT_DATE"),
                    DaysAway       = reader.GetInt("DAYS_AWAY"),
                    YearsCompleted = reader.GetIntOrNull("YEARS_COMPLETED")
                });
            }

            return events;
        }

        public EmailNotificationTemplate? GetEmailNotificationTemplate(
            EmailNotificationType notificationType)
        {
            using SqlConnection connection = _adoHelper.GetConnection();

            using SqlCommand command = _adoHelper.CreateStoredProcedureCommand(
                connection,
                "SP_GET_AUTO_EMAIL_NOTIFICATION",
                new SqlParameter("@ID", (int)notificationType));

            using SqlDataReader reader = _adoHelper.ExecuteReader(command);

            if (!reader.Read())
            {
                return null;
            }

            return new EmailNotificationTemplate
            {
                Id        = reader.GetInt("ID"),
                Code      = reader.GetStringOrEmpty("CODE"),
                Name      = reader.GetStringOrEmpty("NAME"),
                Subject   = reader.GetStringOrEmpty("SUBJECT"),
                Body      = reader.GetStringOrEmpty("BODY"),
                IsActive  = reader.GetBool("IS_ACTIVE"),
                ToEmail   = reader.GetStringOrNull("TO_EMAIL"),
                CcEmail   = reader.GetStringOrNull("CC_EMAIL"),
                BccEmail  = reader.GetStringOrNull("BCC_EMAIL")
            };
        }
    }
}
