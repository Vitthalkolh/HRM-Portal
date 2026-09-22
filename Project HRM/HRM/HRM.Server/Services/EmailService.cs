using System.Net;
using System.Net.Mail;
using System.Text;
using HRM.Server.Infrastructure;
using Microsoft.Extensions.Options;

namespace HRM.Server.Services;

public sealed record EmailMessage(IReadOnlyList<string> To, string Subject, string HtmlBody);

public interface IEmailService
{
    /// <summary>Returns true when the message was handed to the transport (or the dev sink).</summary>
    Task<bool> SendAsync(EmailMessage message, CancellationToken ct = default);
}

/// <summary>
/// SMTP delivery using the framework's <see cref="SmtpClient"/>.
///
/// When <c>Smtp:Enabled</c> is false the message is written as an .eml file into
/// <c>Smtp:PickupDirectory</c> instead of being delivered, so the whole email path can be
/// exercised locally without credentials. When it is true but the configuration is incomplete,
/// the failure is logged loudly rather than silently swallowed.
/// </summary>
public sealed class SmtpEmailService(
    IOptions<SmtpOptions> options,
    IWebHostEnvironment environment,
    ILogger<SmtpEmailService> logger) : IEmailService
{
    private readonly SmtpOptions _options = options.Value;

    public async Task<bool> SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        var recipients = message.To
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (recipients.Count == 0)
        {
            logger.LogWarning("Email '{Subject}' had no recipients and was not sent.", message.Subject);
            return false;
        }

        if (!_options.Enabled)
        {
            return await WriteToPickupDirectoryAsync(message, recipients, ct);
        }

        var configurationError = Validate();
        if (configurationError is not null)
        {
            logger.LogError(
                "SMTP is enabled but misconfigured ({Error}). Email '{Subject}' to {Count} recipient(s) was not sent.",
                configurationError, message.Subject, recipients.Count);
            return false;
        }

        try
        {
            using var client = new SmtpClient(_options.Host, _options.Port)
            {
                EnableSsl = _options.UseStartTls,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                Credentials = string.IsNullOrWhiteSpace(_options.Username)
                    ? CredentialCache.DefaultNetworkCredentials
                    : new NetworkCredential(_options.Username, _options.Password),
            };

            using var mail = new MailMessage
            {
                From = new MailAddress(_options.FromEmail, _options.FromName),
                Subject = message.Subject,
                Body = message.HtmlBody,
                IsBodyHtml = true,
                BodyEncoding = Encoding.UTF8,
            };

            // Recipients go to Bcc for company-wide announcements so addresses are not disclosed.
            foreach (var recipient in recipients) mail.Bcc.Add(recipient);
            mail.To.Add(new MailAddress(_options.FromEmail, _options.FromName));

            await client.SendMailAsync(mail, ct);
            logger.LogInformation("Sent '{Subject}' to {Count} recipient(s).", message.Subject, recipients.Count);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "SMTP delivery of '{Subject}' to {Count} recipient(s) failed.", message.Subject, recipients.Count);
            return false;
        }
    }

    private string? Validate()
    {
        if (string.IsNullOrWhiteSpace(_options.Host)) return "Smtp:Host is empty";
        if (_options.Host.Equals("smtp.example.com", StringComparison.OrdinalIgnoreCase)) return "Smtp:Host is still the placeholder value";
        if (_options.Port is <= 0 or > 65535) return "Smtp:Port is out of range";
        if (string.IsNullOrWhiteSpace(_options.FromEmail)) return "Smtp:FromEmail is empty";
        if (_options.FromEmail.EndsWith("@example.com", StringComparison.OrdinalIgnoreCase)) return "Smtp:FromEmail is still the placeholder value";
        return null;
    }

    private async Task<bool> WriteToPickupDirectoryAsync(EmailMessage message, IReadOnlyList<string> recipients, CancellationToken ct)
    {
        try
        {
            var directory = Path.Combine(environment.ContentRootPath, _options.PickupDirectory);
            Directory.CreateDirectory(directory);

            var safeSubject = string.Concat(message.Subject.Where(char.IsLetterOrDigit).Take(40));
            var path = Path.Combine(directory, $"{DateTime.UtcNow:yyyyMMdd-HHmmssfff}-{safeSubject}.eml");

            var contents = new StringBuilder()
                .AppendLine($"From: {_options.FromName} <{_options.FromEmail}>")
                .AppendLine($"Bcc: {string.Join(", ", recipients)}")
                .AppendLine($"Subject: {message.Subject}")
                .AppendLine("Content-Type: text/html; charset=utf-8")
                .AppendLine()
                .AppendLine(message.HtmlBody)
                .ToString();

            await File.WriteAllTextAsync(path, contents, ct);
            logger.LogInformation(
                "SMTP is disabled; email '{Subject}' for {Count} recipient(s) was written to {Path}.",
                message.Subject, recipients.Count, path);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Could not write email '{Subject}' to the development pickup directory.", message.Subject);
            return false;
        }
    }
}
