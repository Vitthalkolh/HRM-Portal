using HRM.API.Models;
using HRM.API.Models.Leave;

namespace HRM.API.Repository
{
    public interface ILeaveRepository
    {
        List<LeaveTypeResponse> GetLeaveTypes(bool applicableOnly);

        void AllocateEmployeeLeave(
            int userId,
            int year,
            int createdBy,
            int? leaveTypeId = null,
            decimal? entitlement = null);

        int ApplyEmployeeLeave(int userId, ApplyLeaveRequest request, int createdBy);

        int UpdateEmployeeLeaveStatus(int id, int statusId, int changedBy, string? rejectReason);

        int CancelEmployeeLeave(int id, int cancelledBy);

        List<EmployeeLeaveResponse> GetEmployeeLeaves(
            int? userId,
            int? statusId,
            DateTime? fromDate,
            DateTime? toDate);

        EmployeeLeaveResponse? GetEmployeeLeaveById(int id);

        List<EmployeeLeaveBalanceResponse> GetEmployeeLeaveBalance(int userId, int year);

        List<EmployeeCalendarResponse> GetEmployeeCalendar(int year, int month, int? userId);
    }
}
