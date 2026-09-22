using HRM.API.Models.Email;

namespace HRM.API.Services.Email
{
    public interface IEmailService
    {
        Task SendEmailAsync(string to, string subject, string body, string? cc = null);

        /// <summary>
        /// Loads the template for the notification type, substitutes the
        /// {{Token}} placeholders and sends it. Never throws: a mail failure
        /// must not roll back the leave action that triggered it.
        /// </summary>
        Task SendNotificationAsync(
            EmailNotificationType notificationType,
            string toEmail,
            IDictionary<string, string> placeholders);
    }
}
