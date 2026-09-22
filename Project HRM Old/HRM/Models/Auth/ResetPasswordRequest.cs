using System.ComponentModel.DataAnnotations;

namespace HRM.API.Models.Auth
{
    public class ResetPasswordRequest
    {
        [Required]
        [MinLength(8, ErrorMessage = "Password must be at least 8 characters.")]
        public string NewPassword { get; set; } = string.Empty;
    }
}
