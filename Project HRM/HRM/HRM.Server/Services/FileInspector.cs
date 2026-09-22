namespace HRM.Server.Services;

public sealed record FileSignature(string ContentType, string Extension, int? Width, int? Height);

/// <summary>
/// Content-based file identification. The declared content type and the file extension are both
/// attacker-controlled, so the real type is derived from the leading bytes, and image dimensions
/// are parsed from the header rather than trusted from the request.
///
/// Supports the formats this product accepts: JPEG, PNG, WebP and PDF.
/// </summary>
public static class FileInspector
{
    public static FileSignature? Inspect(Stream stream)
    {
        if (!stream.CanSeek) throw new ArgumentException("A seekable stream is required.", nameof(stream));

        stream.Position = 0;
        Span<byte> header = stackalloc byte[32];
        var read = stream.Read(header);
        stream.Position = 0;
        if (read < 12) return null;

        if (header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF)
        {
            var (w, h) = ReadJpegSize(stream);
            return new FileSignature("image/jpeg", ".jpg", w, h);
        }

        if (header[..8].SequenceEqual<byte>([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
        {
            var (w, h) = ReadPngSize(stream);
            return new FileSignature("image/png", ".png", w, h);
        }

        if (header[..4].SequenceEqual("RIFF"u8) && header[8..12].SequenceEqual("WEBP"u8))
        {
            var (w, h) = ReadWebPSize(stream);
            return new FileSignature("image/webp", ".webp", w, h);
        }

        if (header[..4].SequenceEqual("%PDF"u8))
        {
            return new FileSignature("application/pdf", ".pdf", null, null);
        }

        return null;
    }

    private static (int? Width, int? Height) ReadPngSize(Stream stream)
    {
        stream.Position = 16;
        Span<byte> buffer = stackalloc byte[8];
        if (stream.Read(buffer) < 8) return (null, null);
        stream.Position = 0;

        var width = (buffer[0] << 24) | (buffer[1] << 16) | (buffer[2] << 8) | buffer[3];
        var height = (buffer[4] << 24) | (buffer[5] << 16) | (buffer[6] << 8) | buffer[7];
        return (width, height);
    }

    private static (int? Width, int? Height) ReadWebPSize(Stream stream)
    {
        // Handles the three WebP container variants: lossy (VP8 ), lossless (VP8L) and extended (VP8X).
        stream.Position = 12;
        Span<byte> chunk = stackalloc byte[18];
        if (stream.Read(chunk) < 18) { stream.Position = 0; return (null, null); }
        stream.Position = 0;

        if (chunk[..4].SequenceEqual("VP8 "u8))
        {
            var width = ((chunk[15] << 8) | chunk[14]) & 0x3FFF;
            var height = ((chunk[17] << 8) | chunk[16]) & 0x3FFF;
            return (width, height);
        }

        if (chunk[..4].SequenceEqual("VP8L"u8))
        {
            var bits = chunk[9] | (chunk[10] << 8) | (chunk[11] << 16) | (chunk[12] << 24);
            return ((bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1);
        }

        if (chunk[..4].SequenceEqual("VP8X"u8))
        {
            var width = (chunk[12] | (chunk[13] << 8) | (chunk[14] << 16)) + 1;
            var height = (chunk[15] | (chunk[16] << 8) | (chunk[17] << 16)) + 1;
            return (width, height);
        }

        return (null, null);
    }

    private static (int? Width, int? Height) ReadJpegSize(Stream stream)
    {
        stream.Position = 2;
        try
        {
            Span<byte> marker = stackalloc byte[4];
            while (stream.Position < stream.Length)
            {
                if (stream.ReadByte() != 0xFF) continue;

                int code;
                do { code = stream.ReadByte(); } while (code == 0xFF);
                if (code is < 0 or 0xD8 or 0xD9) break;

                // Start-of-frame markers carry the dimensions; SOF4/SOF8/SOF12 are not frame markers.
                var isStartOfFrame = code is >= 0xC0 and <= 0xCF and not 0xC4 and not 0xC8 and not 0xCC;

                if (stream.Read(marker[..2]) < 2) break;
                var length = (marker[0] << 8) | marker[1];

                if (isStartOfFrame)
                {
                    Span<byte> frame = stackalloc byte[5];
                    if (stream.Read(frame) < 5) break;
                    var height = (frame[1] << 8) | frame[2];
                    var width = (frame[3] << 8) | frame[4];
                    return (width, height);
                }

                if (length < 2) break;
                stream.Position += length - 2;
            }
        }
        catch (Exception)
        {
            // A malformed image simply has no readable dimensions; the caller rejects it.
        }
        finally
        {
            stream.Position = 0;
        }

        return (null, null);
    }
}
