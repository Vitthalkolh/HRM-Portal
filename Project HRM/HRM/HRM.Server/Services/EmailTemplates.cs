using System.Net;
using HRM.Server.Entities;

namespace HRM.Server.Services;

/// <summary>
/// The three emails the product requires: leave approval, birthday, and password reset.
/// Every interpolated value is HTML-encoded.
/// </summary>
public static class EmailTemplates
{
    public static (string Subject, string Body) LeaveApproved(
        string companyName, Employee employee, LeaveType leaveType, LeaveRequest request, string approvedBy)
    {
        var name = Encode(employee.FullName);
        var subject = $"Leave approved: {employee.FullName} ({leaveType.Code}) {request.FromDate:dd MMM} - {request.ToDate:dd MMM yyyy}";

        var body = Shell(companyName, "Leave approved", $"""
            <p style="margin:0 0 16px">A leave request has been approved.</p>
            {Row("Employee", $"{name} ({Encode(employee.EmployeeCode)})")}
            {Row("Leave type", $"{Encode(leaveType.Name)} ({Encode(leaveType.Code)})")}
            {Row("From", request.FromDate.ToString("dd MMM yyyy"))}
            {Row("To", request.ToDate.ToString("dd MMM yyyy"))}
            {Row("Days", request.Days.ToString("0.##") + (request.IsHalfDay ? $" (half day, {Encode(request.HalfDaySession ?? string.Empty)})" : string.Empty))}
            {Row("Reason", Encode(request.Reason))}
            {Row("Approved by", Encode(approvedBy))}
            """);

        return (subject, body);
    }

    public static (string Subject, string Body) Birthday(string companyName, Employee employee, string? imageUrl)
    {
        var name = Encode(employee.FullName);
        var subject = $"Happy birthday, {employee.FullName}!";

        var avatar = string.IsNullOrWhiteSpace(imageUrl)
            ? string.Empty
            : $"""<p style="margin:0 0 16px"><img src="{Encode(imageUrl)}" alt="{name}" width="96" height="96" style="border-radius:50%;object-fit:cover"></p>""";

        var body = Shell(companyName, "Happy birthday!", $"""
            {avatar}
            <p style="margin:0 0 12px;font-size:18px">Today is <strong>{name}</strong>'s birthday.</p>
            <p style="margin:0 0 16px">{Encode(employee.Designation ?? "Team member")}{(string.IsNullOrWhiteSpace(employee.Department) ? "" : " &middot; " + Encode(employee.Department!))}</p>
            <p style="margin:0">Please join the whole team in wishing them a wonderful year ahead.</p>
            """);

        return (subject, body);
    }

    public static (string Subject, string Body) PasswordReset(string companyName, string resetLink, int validForMinutes)
    {
        const string subject = "Reset your HRM password";

        var body = Shell(companyName, "Password reset", $"""
            <p style="margin:0 0 16px">We received a request to reset your HRM password.</p>
            <p style="margin:0 0 24px">
              <a href="{Encode(resetLink)}"
                 style="background:#6655e8;color:#ffffff;padding:12px 22px;border-radius:10px;text-decoration:none;display:inline-block;font-weight:600">
                Choose a new password
              </a>
            </p>
            <p style="margin:0 0 8px;color:#5b6077">This link expires in {validForMinutes} minutes and can be used once.</p>
            <p style="margin:0;color:#5b6077">If you did not request this, you can safely ignore this email; your password will not change.</p>
            """);

        return (subject, body);
    }

    private static string Row(string label, string value) => $"""
        <p style="margin:0 0 8px"><span style="display:inline-block;min-width:120px;color:#5b6077">{label}</span><strong>{value}</strong></p>
        """;

    private static string Shell(string companyName, string heading, string content) => $"""
        <!doctype html>
        <html><body style="margin:0;background:#f6f7fb;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#171a2b">
          <div style="max-width:600px;margin:0 auto;padding:24px">
            <div style="background:#0c1128;color:#ffffff;padding:20px 28px;border-radius:16px 16px 0 0">
              <div style="font-weight:800;letter-spacing:.08em;font-size:12px;color:#b6aaff">{Encode(companyName).ToUpperInvariant()}</div>
              <div style="font-size:22px;font-weight:700;margin-top:4px">{Encode(heading)}</div>
            </div>
            <div style="background:#ffffff;padding:28px;border-radius:0 0 16px 16px">
              {content}
            </div>
            <p style="color:#8b90a6;font-size:12px;margin:16px 0 0">This is an automated message from the {Encode(companyName)} HRM portal.</p>
          </div>
        </body></html>
        """;

    private static string Encode(string value) => WebUtility.HtmlEncode(value);
}
