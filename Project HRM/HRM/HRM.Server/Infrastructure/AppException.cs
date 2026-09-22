namespace HRM.Server.Infrastructure;

/// <summary>
/// Thrown for expected, user-facing failures. The middleware turns it into the standard
/// ApiResponse envelope with the given status code; anything else becomes a generic 500.
/// </summary>
public sealed class AppException(int statusCode, string message, IDictionary<string, string[]>? errors = null)
    : Exception(message)
{
    public int StatusCode { get; } = statusCode;
    public IDictionary<string, string[]>? Errors { get; } = errors;

    public static AppException BadRequest(string message) => new(StatusCodes.Status400BadRequest, message);
    public static AppException NotFound(string message = "The requested item was not found.") => new(StatusCodes.Status404NotFound, message);
    public static AppException Forbidden(string message = "You do not have access to this item.") => new(StatusCodes.Status403Forbidden, message);
    public static AppException Conflict(string message) => new(StatusCodes.Status409Conflict, message);
    public static AppException Unauthorized(string message = "Please sign in to continue.") => new(StatusCodes.Status401Unauthorized, message);
}
