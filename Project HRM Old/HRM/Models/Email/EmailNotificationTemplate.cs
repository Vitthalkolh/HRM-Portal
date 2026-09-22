namespace HRM.API.Models.Email
{
    public class EmailNotificationTemplate
    {
        public int Id { get; set; }
        public string Code { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;

        public string? ToEmail { get; set; }
        public string? CcEmail { get; set; }
        public string? BccEmail { get; set; }

        public string Subject { get; set; } = string.Empty;
        public string Body { get; set; } = string.Empty;

        public bool IsActive { get; set; }
    }
}
