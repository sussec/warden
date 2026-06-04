using Warden.Application.Module.Token.Command;
using Warden.Application.Module.Token.Model;
using Warden.Core.Entity;
using Warden.Core.Extension;
using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Token;

public interface ITokenService
{
    Task<CiTokens> CreateTokenAsync(CreateTokenRequest request);
    Task<bool> DeleteTokenAsync(Guid tokenId);
    Task<List<CiTokens>> ListTokensAsync();
}

public class TokenService(AppDbContext context) : ITokenService
{
    public async Task<CiTokens> CreateTokenAsync(CreateTokenRequest request)
    {
        return (await new CreateTokenCommand(context).ExecuteAsync(request)).GetResult();
    }

    public async Task<bool> DeleteTokenAsync(Guid tokenId)
    {
        return (await new DeleteTokenCommand(context).ExecuteAsync(tokenId)).GetResult();
    }

    public Task<List<CiTokens>> ListTokensAsync()
    {
        return context.CiTokens.OrderByDescending(record => record.CreatedAt).ToListAsync();
    }
}