namespace HRM.API.Services.Email
{
    public class EmailSettings
    {
        /// <summary>When false, mail is logged instead of sent. Default for dev.</summary>
        public bool Enabled { get; set; }
        public string Host { get; set; } = string.Empty;
        public int Port { get; set; } = 587;
        public bool UseSsl { get; set; } = true;
        public string UserName { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string FromAddress { get; set; } = string.Empty;
        public string FromName { get; set; } = "HRM Portal";
    }
}
