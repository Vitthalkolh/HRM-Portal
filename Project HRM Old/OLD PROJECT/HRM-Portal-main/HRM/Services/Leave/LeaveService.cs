using System.Globalization;
using HRM.API.Models;
using HRM.API.Models.Email;
using HRM.API.Models.Leave;
using HRM.API.Repository;
using HRM.API.Services.Email;

namespace HRM.API.Services
{
    public class LeaveService : ILeaveService
    {
        private const int StatusApproved = 2;
        private const int StatusRejected = 3;

        private readonly ILeaveRepository _leaveRepository;
        private readonly IUserRepository _userRepository;
        private readonly IEmailService _emailService;

        public LeaveService(
            ILeaveRepository leaveRepository,
            IUserRepository userRepository,
            IEmailService emailService)
        {
            _leaveRepository = leaveRepository;
            _userRepository = userRepository;
            _emailService = emailService;
        }

        public List<LeaveTypeResponse> GetLeaveTypes(bool applicableOnly)
        {
            return _leaveRepository.GetLeaveTypes(applicableOnly);
        }

        public void AllocateEmployeeLeave(
            int userId,
            int year,
            int createdBy,
            int? leaveTypeId = null,
            decimal? entitlement = null)
        {
            _leaveRepository.AllocateEmployeeLeave(userId, year, createdBy, leaveTypeId, entitlement);
        }

        public async Task<int> ApplyEmployeeLeaveAsync(
            int userId,
            ApplyLeaveRequest request,
            int createdBy)
        {
            int leaveId = _leaveRepository.ApplyEmployeeLeave(userId, request, createdBy);

            if (leaveId <= 0)
            {
                return leaveId;
            }

            EmployeeLeaveResponse? leave = _leaveRepository.GetEmployeeLeaveById(leaveId);

            if (leave != null)
            {
                // Tell the admins there is something to approve.
                List<UserResponse> admins = _userRepository
                    .GetAllUsers(includeInactive: false)
                    .Where(u => u.IsAdmin)
                    .ToList();

                foreach (UserResponse admin in admins)
                {
                    await _emailService.SendNotificationAsync(
                        EmailNotificationType.LeaveApplied,
                        admin.Email,
                        BuildPlaceholders(leave, actionBy: leave.EmployeeName));
                }
            }

            return leaveId;
        }

        public async Task<int> UpdateEmployeeLeaveStatusAsync(
            int id,
            int statusId,
            int changedBy,
            string? rejectReason)
        {
            int result = _leaveRepository.UpdateEmployeeLeaveStatus(
                id,
                statusId,
                changedBy,
                rejectReason);

            if (result <= 0)
            {
                return result;
            }

            await NotifyEmployeeAsync(
                id,
                statusId == StatusApproved
                    ? EmailNotificationType.LeaveApproved
                    : EmailNotificationType.LeaveRejected,
                changedBy,
                rejectReason);

            return result;
        }

        public async Task<int> CancelEmployeeLeaveAsync(int id, int cancelledBy)
        {
            int result = _leaveRepository.CancelEmployeeLeave(id, cancelledBy);

            if (result <= 0)
            {
                return result;
            }

            await NotifyEmployeeAsync(
                id,
                EmailNotificationType.LeaveCancelled,
                cancelledBy,
                rejectReason: null);

            return result;
        }

        public List<EmployeeLeaveResponse> GetEmployeeLeaves(
            int? userId,
            int? statusId,
            DateTime? fromDate,
            DateTime? toDate)
        {
            return _leaveRepository.GetEmployeeLeaves(userId, statusId, fromDate, toDate);
        }

        public EmployeeLeaveResponse? GetEmployeeLeaveById(int id)
        {
            return _leaveRepository.GetEmployeeLeaveById(id);
        }

        public List<EmployeeLeaveBalanceResponse> GetEmployeeLeaveBalance(int userId, int year)
        {
            return _leaveRepository.GetEmployeeLeaveBalance(userId, year);
        }

        public List<EmployeeCalendarResponse> GetEmployeeCalendar(int year, int month, int? userId)
        {
            return _leaveRepository.GetEmployeeCalendar(year, month, userId);
        }

        private async Task NotifyEmployeeAsync(
            int leaveId,
            EmailNotificationType notificationType,
            int actionById,
            string? rejectReason)
        {
            EmployeeLeaveResponse? leave = _leaveRepository.GetEmployeeLeaveById(leaveId);

            if (leave?.EmployeeEmail == null)
            {
                return;
            }

            UserResponse? actionBy = _userRepository.GetUserById(actionById);

            await _emailService.SendNotificationAsync(
                notificationType,
                leave.EmployeeEmail,
                BuildPlaceholders(leave, actionBy?.FullName ?? "HR", rejectReason));
        }

        private static Dictionary<string, string> BuildPlaceholders(
            EmployeeLeaveResponse leave,
            string actionBy,
            string? rejectReason = null)
        {
            return new Dictionary<string, string>
            {
                ["EmployeeName"] = leave.EmployeeName,
                ["LeaveType"]    = leave.LeaveTypeName,
                ["FromDate"]     = leave.FromDate.ToString("dd MMM yyyy", CultureInfo.InvariantCulture),
                ["ToDate"]       = leave.ToDate.ToString("dd MMM yyyy", CultureInfo.InvariantCulture),
                ["TotalDays"]    = leave.TotalDays.ToString("0.##", CultureInfo.InvariantCulture),
                ["Reason"]       = rejectReason ?? leave.Reason ?? "-",
                ["ActionBy"]     = actionBy
            };
        }
    }
}
