using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace HRM.Server.Data;

/// <summary>
/// Design-time factory used by `dotnet ef`. It exists so migration commands do not have to boot
/// the whole application (which requires a JWT secret and other runtime configuration).
///
/// Migrations are always generated for SQL Server, which is the product database.
/// </summary>
public sealed class HrmDbContextFactory : IDesignTimeDbContextFactory<HrmDbContext>
{
    public HrmDbContext CreateDbContext(string[] args)
    {
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddUserSecrets<HrmDbContextFactory>(optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? "Server=(localdb)\\MSSQLLocalDB;Database=HRM;Trusted_Connection=True;TrustServerCertificate=True";

        var options = new DbContextOptionsBuilder<HrmDbContext>()
            .UseSqlServer(connectionString)
            .Options;

        return new HrmDbContext(options);
    }
}
