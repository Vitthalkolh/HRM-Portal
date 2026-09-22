using HRM.API.Models.Dashboard;

namespace HRM.API.Services
{
    public interface IDashboardService
    {
        DashboardSummaryResponse GetDashboardSummary(int userId, bool isAdmin);
        List<EmployeeEventResponse> GetUpcomingBirthdays(int days);
        List<EmployeeEventResponse> GetWorkAnniversaries(int days);
    }
}
