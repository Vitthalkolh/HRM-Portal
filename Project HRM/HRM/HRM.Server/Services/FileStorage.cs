using HRM.Server.Data;
using HRM.Server.Entities;
using HRM.Server.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace HRM.Server.Services;

/// <summary>The four upload categories in the product, each with its own policy.</summary>
public enum FileCategory { ProfileImage, SalarySlip, ReimbursementAttachment, ReferralResume }

public sealed record FileCategoryPolicy(
    string Folder,
    long MaxBytes,
    IReadOnlySet<string> AllowedContentTypes,
    int? MinWidth = null,
    int? MinHeight = null);

public interface IFileStorage
{
    /// <summary>Validates and stores an upload, recording ownership metadata for later download checks.</summary>
    Task<StoredFile> SaveAsync(IFormFile file, FileCategory category, int ownerEmployeeId, int uploadedByUserId, CancellationToken ct = default);

    Task<Stream> OpenReadAsync(StoredFile file, CancellationToken ct = default);

    void Delete(string? relativePath);
}

public sealed class LocalFileStorage(
    HrmDbContext db,
    IWebHostEnvironment environment,
    IOptions<StorageOptions> options,
    ILogger<LocalFileStorage> logger) : IFileStorage
{
    private readonly string _root = Path.GetFullPath(Path.Combine(environment.ContentRootPath, options.Value.RootPath));

    private static readonly Dictionary<FileCategory, FileCategoryPolicy> Policies = new()
    {
        [FileCategory.ProfileImage] = new(
            "profile", 2 * 1024 * 1024,
            new HashSet<string> { "image/jpeg", "image/png", "image/webp" },
            MinWidth: 300, MinHeight: 300),

        [FileCategory.SalarySlip] = new(
            "salary", 5 * 1024 * 1024,
            new HashSet<string> { "application/pdf" }),

        [FileCategory.ReimbursementAttachment] = new(
            "reimbursement", 5 * 1024 * 1024,
            new HashSet<string> { "application/pdf", "image/jpeg", "image/png", "image/webp" }),

        [FileCategory.ReferralResume] = new(
            "referral", 5 * 1024 * 1024,
            new HashSet<string> { "application/pdf" }),
    };

    public static FileCategoryPolicy PolicyFor(FileCategory category) => Policies[category];

    public async Task<StoredFile> SaveAsync(
        IFormFile file, FileCategory category, int ownerEmployeeId, int uploadedByUserId, CancellationToken ct = default)
    {
        var policy = Policies[category];

        if (file is null || file.Length == 0)
            throw AppException.BadRequest("Please choose a file to upload.");

        if (file.Length > policy.MaxBytes)
            throw AppException.BadRequest($"The file must be {policy.MaxBytes / (1024 * 1024)} MB or smaller.");

        // Buffer to a seekable stream so the real type can be read from the content itself.
        await using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, ct);
        buffer.Position = 0;

        var signature = FileInspector.Inspect(buffer)
            ?? throw AppException.BadRequest(Describe(policy, "The file type could not be recognised."));

        if (!policy.AllowedContentTypes.Contains(signature.ContentType))
            throw AppException.BadRequest(Describe(policy, $"Files of type {signature.ContentType} are not accepted here."));

        if (policy.MinWidth is not null || policy.MinHeight is not null)
        {
            if (signature.Width is null || signature.Height is null)
                throw AppException.BadRequest("The image dimensions could not be read. Please use a standard JPG, PNG or WebP file.");

            if (signature.Width < policy.MinWidth || signature.Height < policy.MinHeight)
                throw AppException.BadRequest(
                    $"The image must be at least {policy.MinWidth}x{policy.MinHeight} pixels. This one is {signature.Width}x{signature.Height}.");
        }

        // The stored name is generated, never derived from the uploaded file name.
        var storedName = $"{Guid.NewGuid():N}{signature.Extension}";
        var folder = Path.Combine(_root, policy.Folder);
        Directory.CreateDirectory(folder);

        buffer.Position = 0;
        await using (var output = File.Create(Path.Combine(folder, storedName)))
        {
            await buffer.CopyToAsync(output, ct);
        }

        var record = new StoredFile
        {
            UploadedByUserId = uploadedByUserId,
            OwnerEmployeeId = ownerEmployeeId,
            Category = category.ToString(),
            OriginalFileName = Path.GetFileName(file.FileName),
            StoredFileName = storedName,
            ContentType = signature.ContentType,
            Size = file.Length,
            StoragePath = $"{policy.Folder}/{storedName}",
        };

        db.StoredFiles.Add(record);
        await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "Stored {Category} file {FileId} ({Size} bytes) for employee {EmployeeId}.",
            category, record.Id, record.Size, ownerEmployeeId);

        return record;
    }

    public Task<Stream> OpenReadAsync(StoredFile file, CancellationToken ct = default)
    {
        var full = ResolveInsideRoot(file.StoragePath)
            ?? throw AppException.NotFound("The stored file is no longer available.");

        if (!File.Exists(full)) throw AppException.NotFound("The stored file is no longer available.");
        return Task.FromResult<Stream>(File.OpenRead(full));
    }

    public void Delete(string? relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath)) return;

        var full = ResolveInsideRoot(relativePath);
        if (full is null)
        {
            logger.LogWarning("Refused to delete a path outside the storage root.");
            return;
        }

        try
        {
            if (File.Exists(full)) File.Delete(full);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Could not delete stored file {Path}.", relativePath);
        }
    }

    /// <summary>
    /// Resolves a relative path and confirms it stays inside the storage root. The comparison is
    /// anchored with a directory separator so a sibling directory such as "storage-evil" cannot
    /// pass a plain prefix check against "storage".
    /// </summary>
    private string? ResolveInsideRoot(string relativePath)
    {
        var full = Path.GetFullPath(Path.Combine(_root, relativePath));
        var rootWithSeparator = _root.EndsWith(Path.DirectorySeparatorChar)
            ? _root
            : _root + Path.DirectorySeparatorChar;

        return full.StartsWith(rootWithSeparator, StringComparison.Ordinal) ? full : null;
    }

    private static string Describe(FileCategoryPolicy policy, string prefix)
    {
        var types = string.Join(", ", policy.AllowedContentTypes.Select(x => x.Split('/')[^1].ToUpperInvariant()).Order());
        return $"{prefix} Accepted formats: {types}.";
    }
}
