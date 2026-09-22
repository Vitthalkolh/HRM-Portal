namespace HRM.Server.Infrastructure;

public sealed class JwtOptions
{
    public const string Section = "Jwt";
    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = "HRM.Server";
    public string Audience { get; set; } = "HRM.Client";
    public int AccessTokenMinutes { get; set; } = 30;
    public int RefreshTokenDays { get; set; } = 14;
}

public sealed class SmtpOptions
{
    public const string Section = "Smtp";

    /// <summary>When false, mail is written to the development sink instead of being delivered.</summary>
    public bool Enabled { get; set; }
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public bool UseStartTls { get; set; } = true;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FromEmail { get; set; } = string.Empty;
    public string FromName { get; set; } = "HRM";

    /// <summary>Where the development sink writes .eml files when <see cref="Enabled"/> is false.</summary>
    public string PickupDirectory { get; set; } = "App_Data/Mail";
}

public sealed class RateLimitOptions
{
    public const string Section = "RateLimiting";

    /// <summary>Requests allowed per window, per client IP, on the authentication endpoints.</summary>
    public int AuthPermitLimit { get; set; } = 10;
    public int AuthWindowSeconds { get; set; } = 60;
}

public sealed class StorageOptions
{
    public const string Section = "Storage";
    public string RootPath { get; set; } = "App_Data/Storage";
}

public sealed class AppOptions
{
    public const string Section = "App";

    /// <summary>Public SPA base URL, used to build password-reset links in email.</summary>
    public string ClientBaseUrl { get; set; } = "http://localhost:5173";
    public string CompanyName { get; set; } = "HRM";

    /// <summary>Days between an SNU release and an NTNS release below which the SNU occurrence is cancelled.</summary>
    public int SnuCancellationWindowDays { get; set; } = 7;
}

public sealed class InitialAdminOptions
{
    public const string Section = "InitialAdmin";
    public string Email { get; set; } = "admin@hrm.local";
    public string UserName { get; set; } = "admin";
    public string? Password { get; set; }

    /// <summary>Seeds a small demo dataset (employees, holidays, planning) for local evaluation only.</summary>
    public bool SeedDemoData { get; set; }
}
