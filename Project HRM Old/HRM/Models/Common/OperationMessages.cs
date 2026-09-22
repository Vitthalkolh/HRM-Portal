namespace HRM.API.Models.Common
{
    /// <summary>
    /// Stored procedures signal failures with negative return codes. These maps
    /// turn a code into the message the API returns, so controllers do not each
    /// repeat the same if-chain.
    /// </summary>
    public static class OperationMessages
    {
        private static readonly Dictionary<int, string> ApplyLeave = new()
        {
            [-1] = "From date cannot be later than the To date.",
            [-2] = "A leave request cannot span two calendar years. Please apply separately for each year.",
            [-3] = "A half-day leave can only be applied for a single date.",
            [-4] = "No leave balance has been allocated to you for this year. Please contact HR.",
            [-5] = "You already have a leave request covering one or more of these dates.",
            [-6] = "The selected range contains no working days.",
            [-7] = "Insufficient leave balance for this leave type.",
            [-8] = "This leave type is not available to apply for.",
            [-9] = "This leave type cannot be taken as a half day."
        };

        private static readonly Dictionary<int, string> LeaveStatus = new()
        {
            [-1] = "Leave request not found, or it has already been processed.",
            [-2] = "No leave balance record found for this employee and year.",
            [-3] = "Insufficient leave balance to approve this request.",
            [-4] = "Invalid leave status."
        };

        private static readonly Dictionary<int, string> CancelLeave = new()
        {
            [-1] = "Leave request not found, or it is not in a cancellable state.",
            [-2] = "No leave balance record found for this employee and year."
        };

        private static readonly Dictionary<int, string> OptionalHoliday = new()
        {
            [-1] = "Optional holiday not found.",
            [-2] = "You have already applied for this optional holiday.",
            [-3] = "This optional holiday date has already passed.",
            [-4] = "You have used all of your optional holidays for this year."
        };

        private static readonly Dictionary<int, string> OptionalHolidayStatus = new()
        {
            [-1] = "Optional holiday request not found, or it has already been processed.",
            [-4] = "Invalid status."
        };

        private static readonly Dictionary<int, string> User = new()
        {
            [-1] = "This username is already taken.",
            [-2] = "This email address is already registered to another employee."
        };

        private static readonly Dictionary<int, string> UserUpdate = new()
        {
            [-1] = "Employee not found.",
            [-2] = "This email address is already registered to another employee."
        };

        private static readonly Dictionary<int, string> Holiday = new()
        {
            [-1] = "A holiday with this name already exists on that date."
        };

        private const string Fallback = "The request could not be completed.";

        private static string Describe(Dictionary<int, string> map, int code)
        {
            return map.TryGetValue(code, out string? message) ? message : Fallback;
        }

        public static string ForApplyLeave(int code)            => Describe(ApplyLeave, code);
        public static string ForLeaveStatus(int code)           => Describe(LeaveStatus, code);
        public static string ForCancelLeave(int code)           => Describe(CancelLeave, code);
        public static string ForOptionalHoliday(int code)       => Describe(OptionalHoliday, code);
        public static string ForOptionalHolidayStatus(int code) => Describe(OptionalHolidayStatus, code);
        public static string ForCreateUser(int code)            => Describe(User, code);
        public static string ForUpdateUser(int code)            => Describe(UserUpdate, code);
        public static string ForHoliday(int code)               => Describe(Holiday, code);
    }
}
