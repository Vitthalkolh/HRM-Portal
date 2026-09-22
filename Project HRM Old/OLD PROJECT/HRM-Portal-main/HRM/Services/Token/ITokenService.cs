using HRM.API.Models;

namespace HRM.API.Services.Token
{
    public interface ITokenService
    {
        (string Token, DateTime ExpiresAt) CreateToken(LoginResponse user);
    }
}
