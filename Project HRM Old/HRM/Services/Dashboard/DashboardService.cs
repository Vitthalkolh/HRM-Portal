using HRM.API.Models.Dashboard;
using HRM.API.Repository;

namespace HRM.API.Services
{
    public class DashboardService : IDashboardService
    {
        private readonly IDashboardRepository _dashboardRepository;

        public DashboardService(IDashboardRepository dashboardRepository)
        {
            _dashboardRepository = dashboardRepository;
        }

        public DashboardSummaryResponse GetDashboardSummary(int userId, bool isAdmin)
        {
            return _dashboardRepository.GetDashboardSummary(userId, isAdmin);
        }

        public List<EmployeeEventResponse> GetUpcomingBirthdays(int days)
        {
            return _dashboardRepository.GetUpcomingBirthdays(days);
        }

        public List<EmployeeEventResponse> GetWorkAnniversaries(int days)
        {
            return _dashboardRepository.GetWorkAnniversaries(days);
        }
    }
}
