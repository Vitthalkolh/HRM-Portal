using HRM.API.Models;
using HRM.API.Models.Holiday;
using HRM.API.Repository;

namespace HRM.API.Services
{
    public class HolidayService : IHolidayService
    {
        private readonly IHolidayRepository _holidayRepository;

        public HolidayService(IHolidayRepository holidayRepository)
        {
            _holidayRepository = holidayRepository;
        }

        public int CreateCompanyHoliday(CreateHolidayRequest request, int createdBy)
        {
            return _holidayRepository.CreateCompanyHoliday(request, createdBy);
        }

        public List<CompanyHolidayResponse> GetCompanyHolidays(int? year, bool? isOptional)
        {
            return _holidayRepository.GetCompanyHolidays(year, isOptional);
        }

        public int DeleteCompanyHoliday(int id, int changedBy)
        {
            return _holidayRepository.DeleteCompanyHoliday(id, changedBy);
        }

        public int ApplyOptionalHoliday(int userId, int holidayId, int createdBy)
        {
            return _holidayRepository.ApplyOptionalHoliday(userId, holidayId, createdBy);
        }

        public List<OptionalHolidayRequestResponse> GetOptionalHolidayRequests(
            int? userId,
            int? statusId)
        {
            return _holidayRepository.GetOptionalHolidayRequests(userId, statusId);
        }

        public int UpdateOptionalHolidayStatus(
            int id,
            int statusId,
            int changedBy,
            string? rejectReason)
        {
            return _holidayRepository.UpdateOptionalHolidayStatus(
                id,
                statusId,
                changedBy,
                rejectReason);
        }
    }
}
