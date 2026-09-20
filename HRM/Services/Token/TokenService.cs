using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using HRM.API.Helpers;
using HRM.API.Models;
using HRM.API.Models.Auth;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace HRM.API.Services.Token
{
    public class TokenService : ITokenService
    {
        private readonly JwtSettings _settings;

        public TokenService(IOptions<JwtSettings> settings)
        {
            _settings = settings.Value;
        }

        public (string Token, DateTime ExpiresAt) CreateToken(LoginResponse user)
        {
            DateTime expiresAt = DateTime.UtcNow.AddMinutes(_settings.ExpiryMinutes);

            List<Claim> claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Email, user.Email ?? string.Empty),
                new Claim(
                    ClaimTypes.Role,
                    user.IsAdmin
                        ? ClaimsPrincipalExtensions.AdminRole
                        : ClaimsPrincipalExtensions.EmployeeRole)
            };

            SymmetricSecurityKey key =
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.Key));

            SigningCredentials credentials =
                new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            JwtSecurityToken token = new JwtSecurityToken(
                issuer: _settings.Issuer,
                audience: _settings.Audience,
                claims: claims,
                expires: expiresAt,
                signingCredentials: credentials);

            string encoded = new JwtSecurityTokenHandler().WriteToken(token);

            return (encoded, expiresAt);
        }
    }
}
