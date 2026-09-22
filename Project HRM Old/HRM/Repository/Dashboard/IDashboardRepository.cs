using HRM.API.Models.Dashboard;
using HRM.API.Models.Email;

namespace HRM.API.Repository
{
    public interface IDashboardRepository
    {
        DashboardSummaryResponse GetDashboardSummary(int userId, bool isAdmin);
        List<EmployeeEventResponse> GetUpcomingBirthdays(int days);
        List<EmployeeEventResponse> GetWorkAnniversaries(int days);
        EmailNotificationTemplate? GetEmailNotificationTemplate(EmailNotificationType notificationType);
    }
}
