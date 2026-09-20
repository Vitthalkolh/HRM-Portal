using HRM.API.Models;
using HRM.API.Models.Holiday;

namespace HRM.API.Services
{
    public interface IHolidayService
    {
        int CreateCompanyHoliday(CreateHolidayRequest request, int createdBy);
        List<CompanyHolidayResponse> GetCompanyHolidays(int? year, bool? isOptional);
        int DeleteCompanyHoliday(int id, int changedBy);

        int ApplyOptionalHoliday(int userId, int holidayId, int createdBy);
        List<OptionalHolidayRequestResponse> GetOptionalHolidayRequests(int? userId, int? statusId);
        int UpdateOptionalHolidayStatus(int id, int statusId, int changedBy, string? rejectReason);
    }
}
