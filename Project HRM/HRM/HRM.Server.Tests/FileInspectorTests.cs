using System.IO.Compression;
using HRM.Server.Services;
using Xunit;

namespace HRM.Server.Tests;

/// <summary>
/// The file type is derived from the content, never from the extension or the declared MIME
/// type, so these tests use real bytes.
/// </summary>
public sealed class FileInspectorTests
{
    [Fact]
    public void A_png_is_identified_with_its_dimensions()
    {
        var signature = FileInspector.Inspect(new MemoryStream(Png(320, 240)));

        Assert.NotNull(signature);
        Assert.Equal("image/png", signature!.ContentType);
        Assert.Equal(320, signature.Width);
        Assert.Equal(240, signature.Height);
    }

    [Fact]
    public void A_jpeg_is_identified_with_its_dimensions()
    {
        var signature = FileInspector.Inspect(new MemoryStream(Jpeg(640, 480)));

        Assert.NotNull(signature);
        Assert.Equal("image/jpeg", signature!.ContentType);
        Assert.Equal(640, signature.Width);
        Assert.Equal(480, signature.Height);
    }

    [Fact]
    public void A_lossy_webp_is_identified()
    {
        var signature = FileInspector.Inspect(new MemoryStream(WebP(400, 300)));

        Assert.NotNull(signature);
        Assert.Equal("image/webp", signature!.ContentType);
        Assert.Equal(400, signature.Width);
        Assert.Equal(300, signature.Height);
    }

    [Fact]
    public void A_pdf_is_identified()
    {
        var bytes = "%PDF-1.7\n"u8.ToArray().Concat(new byte[64]).ToArray();
        var signature = FileInspector.Inspect(new MemoryStream(bytes));

        Assert.NotNull(signature);
        Assert.Equal("application/pdf", signature!.ContentType);
    }

    [Fact]
    public void An_executable_renamed_as_an_image_is_not_recognised()
    {
        var bytes = "MZ\u0090\0"u8.ToArray().Concat(new byte[256]).ToArray();

        Assert.Null(FileInspector.Inspect(new MemoryStream(bytes)));
    }

    [Fact]
    public void A_text_file_is_not_recognised_as_an_image()
    {
        var bytes = "GIF89a this is not one of the accepted formats"u8.ToArray();

        Assert.Null(FileInspector.Inspect(new MemoryStream(bytes)));
    }

    [Fact]
    public void A_truncated_file_is_rejected_rather_than_throwing()
    {
        Assert.Null(FileInspector.Inspect(new MemoryStream([0x89, 0x50, 0x4E])));
    }

    [Fact]
    public void The_stream_position_is_restored_so_the_caller_can_still_save_it()
    {
        var stream = new MemoryStream(Png(300, 300));
        FileInspector.Inspect(stream);

        Assert.Equal(0, stream.Position);
    }

    [Fact]
    public void Profile_images_require_at_least_300_by_300()
    {
        var policy = LocalFileStorage.PolicyFor(FileCategory.ProfileImage);

        Assert.Equal(300, policy.MinWidth);
        Assert.Equal(300, policy.MinHeight);
        Assert.Equal(2 * 1024 * 1024, policy.MaxBytes);
        Assert.Contains("image/jpeg", policy.AllowedContentTypes);
        Assert.DoesNotContain("application/pdf", policy.AllowedContentTypes);
    }

    [Fact]
    public void Salary_slips_and_resumes_accept_pdf_only()
    {
        Assert.Equal(["application/pdf"], LocalFileStorage.PolicyFor(FileCategory.SalarySlip).AllowedContentTypes);
        Assert.Equal(["application/pdf"], LocalFileStorage.PolicyFor(FileCategory.ReferralResume).AllowedContentTypes);
    }

    // ---------------------------------------------------------------- byte builders

    private static byte[] Png(int width, int height)
    {
        using var output = new MemoryStream();
        output.Write([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

        var header = new byte[13];
        WriteBigEndian(header, 0, width);
        WriteBigEndian(header, 4, height);
        header[8] = 8;
        header[9] = 2;

        WriteChunk(output, "IHDR"u8.ToArray(), header);
        WriteChunk(output, "IDAT"u8.ToArray(), Deflate(new byte[width * 3 + 1]));
        WriteChunk(output, "IEND"u8.ToArray(), []);
        return output.ToArray();
    }

    private static void WriteChunk(Stream stream, byte[] type, byte[] data)
    {
        var length = new byte[4];
        WriteBigEndian(length, 0, data.Length);
        stream.Write(length);
        stream.Write(type);
        stream.Write(data);
        stream.Write(new byte[4]); // CRC is not validated by the inspector.
    }

    private static byte[] Deflate(byte[] data)
    {
        using var output = new MemoryStream();
        using (var deflate = new ZLibStream(output, CompressionLevel.Fastest, leaveOpen: true))
        {
            deflate.Write(data);
        }
        return output.ToArray();
    }

    private static void WriteBigEndian(byte[] buffer, int offset, int value)
    {
        buffer[offset] = (byte)(value >> 24);
        buffer[offset + 1] = (byte)(value >> 16);
        buffer[offset + 2] = (byte)(value >> 8);
        buffer[offset + 3] = (byte)value;
    }

    private static byte[] Jpeg(int width, int height)
    {
        using var output = new MemoryStream();
        output.Write([0xFF, 0xD8]);                           // SOI
        output.Write([0xFF, 0xE0, 0x00, 0x10]);               // APP0, length 16
        output.Write(new byte[14]);
        output.Write([0xFF, 0xC0, 0x00, 0x11, 0x08]);         // SOF0, length 17, precision 8
        output.Write([(byte)(height >> 8), (byte)height]);
        output.Write([(byte)(width >> 8), (byte)width]);
        output.Write(new byte[10]);
        output.Write([0xFF, 0xD9]);                           // EOI
        return output.ToArray();
    }

    private static byte[] WebP(int width, int height)
    {
        using var output = new MemoryStream();
        output.Write("RIFF"u8);
        output.Write(new byte[4]);
        output.Write("WEBP"u8);
        output.Write("VP8 "u8);
        output.Write(new byte[4]);                            // chunk size
        output.Write([0x00, 0x00, 0x00, 0x9D, 0x01, 0x2A]);   // frame tag + sync code
        output.Write([(byte)(width & 0xFF), (byte)(width >> 8)]);
        output.Write([(byte)(height & 0xFF), (byte)(height >> 8)]);
        output.Write(new byte[16]);
        return output.ToArray();
    }
}
