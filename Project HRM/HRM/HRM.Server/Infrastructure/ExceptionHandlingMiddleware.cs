using HRM.Server.DTOs;
using Microsoft.EntityFrameworkCore;

namespace HRM.Server.Infrastructure;

/// <summary>
/// Centralized error handling. Expected failures keep their status code and message;
/// unexpected failures are logged with a correlation id and reported generically so that
/// no server exception detail ever reaches the client.
/// </summary>
public sealed class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            if (context.Response.HasStarted)
            {
                logger.LogError(ex, "Unhandled exception after the response had started.");
                throw;
            }

            var (status, message, errors) = Translate(ex, context, logger);
            context.Response.Clear();
            context.Response.StatusCode = status;
            await context.Response.WriteAsJsonAsync(new ApiResponse<object>(false, message, null, errors));
        }
    }

    private static (int Status, string Message, Dictionary<string, string[]>? Errors) Translate(
        Exception ex, HttpContext context, ILogger logger)
    {
        switch (ex)
        {
            case AppException app:
                logger.LogInformation("Handled {Status} on {Path}: {Message}", app.StatusCode, context.Request.Path, app.Message);
                return (app.StatusCode, app.Message, app.Errors?.ToDictionary(x => x.Key, x => x.Value));

            case DbUpdateConcurrencyException:
                logger.LogWarning(ex, "Concurrency conflict on {Path}.", context.Request.Path);
                return (StatusCodes.Status409Conflict,
                    "Someone else changed this record at the same time. Refresh and try again.", null);

            case OperationCanceledException when context.RequestAborted.IsCancellationRequested:
                return (499, "The request was cancelled.", null);

            default:
                var correlationId = context.TraceIdentifier;
                logger.LogError(ex, "Unhandled exception {CorrelationId} on {Path}.", correlationId, context.Request.Path);
                return (StatusCodes.Status500InternalServerError,
                    $"An unexpected error occurred. Reference: {correlationId}", null);
        }
    }
}
