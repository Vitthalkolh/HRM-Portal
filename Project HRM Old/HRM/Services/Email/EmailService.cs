using System.Net;
using System.Net.Mail;
using System.Text.RegularExpressions;
using HRM.API.Models.Email;
using HRM.API.Repository;
using Microsoft.Extensions.Options;

namespace HRM.API.Services.Email
{
    public class EmailService : IEmailService
    {
        private readonly EmailSettings _settings;
        private readonly IDashboardRepository _dashboardRepository;
        private readonly ILogger<EmailService> _logger;

        public EmailService(
            IOptions<EmailSettings> settings,
            IDashboardRepository dashboardRepository,
            ILogger<EmailService> logger)
        {
            _settings = settings.Value;
            _dashboardRepository = dashboardRepository;
            _logger = logger;
        }

        public async Task SendEmailAsync(string to, string subject, string body, string? cc = null)
        {
            if (!_settings.Enabled)
            {
                _logger.LogInformation(
                    "Email disabled. Would have sent to {To}: {Subject}", to, subject);

                return;
            }

            using MailMessage message = new MailMessage
            {
                From = new MailAddress(_settings.FromAddress, _settings.FromName),
                Subject = subject,
                Body = body,
                IsBodyHtml = true
            };

            message.To.Add(to);

            if (!string.IsNullOrWhiteSpace(cc))
            {
                message.CC.Add(cc);
            }

            using SmtpClient client = new SmtpClient(_settings.Host, _settings.Port)
            {
                EnableSsl = _settings.UseSsl,
                Credentials = new NetworkCredential(_settings.UserName, _settings.Password)
            };

            await client.SendMailAsync(message);
        }

        public async Task SendNotificationAsync(
            EmailNotificationType notificationType,
            string toEmail,
            IDictionary<string, string> placeholders)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(toEmail))
                {
                    return;
                }

                EmailNotificationTemplate? template =
                    _dashboardRepository.GetEmailNotificationTemplate(notificationType);

                if (template == null || !template.IsActive)
                {
                    _logger.LogWarning(
                        "No active email template for {NotificationType}", notificationType);

                    return;
                }

                string subject = Substitute(template.Subject, placeholders);
                string body = Substitute(template.Body, placeholders);

                await SendEmailAsync(toEmail, subject, body, template.CcEmail);
            }
            catch (Exception ex)
            {
                // A failed notification must never fail the underlying action.
                _logger.LogError(
                    ex,
                    "Failed to send {NotificationType} notification to {To}",
                    notificationType,
                    toEmail);
            }
        }

        private static string Substitute(string template, IDictionary<string, string> values)
        {
            return Regex.Replace(template, @"\{\{(\w+)\}\}", match =>
                values.TryGetValue(match.Groups[1].Value, out string? value)
                    ? value
                    : match.Value);
        }
    }
}
