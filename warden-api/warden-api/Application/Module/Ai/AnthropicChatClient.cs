using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.AI;

namespace Warden.Application.Module.Ai;

/// <summary>
/// Minimal <see cref="IChatClient"/> for the Anthropic Messages API
/// (POST {endpoint}/v1/messages, x-api-key + anthropic-version). Hand-rolled to
/// avoid coupling to a third-party SDK's Microsoft.Extensions.AI version — the
/// official SDKs pin specific MEAI builds and break on upgrades. Works with
/// api.anthropic.com and Anthropic-compatible gateways (z.ai, etc.).
/// </summary>
public sealed class AnthropicChatClient : IChatClient
{
    private const string AnthropicVersion = "2023-06-01";
    private const int DefaultMaxTokens = 4096;

    private readonly HttpClient _http = new();
    private readonly string _messagesUrl;
    private readonly string _apiKey;
    private readonly string _defaultModel;

    public AnthropicChatClient(string endpoint, string apiKey, string model)
    {
        var baseUrl = string.IsNullOrEmpty(endpoint) ? "https://api.anthropic.com" : endpoint.TrimEnd('/');
        _messagesUrl = baseUrl + "/v1/messages";
        _apiKey = apiKey;
        _defaultModel = model;
    }

    public async Task<ChatResponse> GetResponseAsync(
        IEnumerable<ChatMessage> messages, ChatOptions? options = null, CancellationToken cancellationToken = default)
    {
        var request = BuildRequest(messages, options);
        using var req = new HttpRequestMessage(HttpMethod.Post, _messagesUrl)
        {
            Content = JsonContent.Create(request),
        };
        req.Headers.TryAddWithoutValidation("x-api-key", _apiKey);
        req.Headers.TryAddWithoutValidation("anthropic-version", AnthropicVersion);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var res = await _http.SendAsync(req, cancellationToken);
        var body = await res.Content.ReadAsStringAsync(cancellationToken);
        if (!res.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"Anthropic API {(int)res.StatusCode}: {Truncate(body)}");
        }

        using var doc = JsonDocument.Parse(body);
        var text = ExtractText(doc.RootElement);
        return new ChatResponse(new ChatMessage(ChatRole.Assistant, text))
        {
            ModelId = doc.RootElement.TryGetProperty("model", out var m) ? m.GetString() : _defaultModel,
        };
    }

    public async IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
        IEnumerable<ChatMessage> messages, ChatOptions? options = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        // Non-streaming under the hood; emit the full response as one update.
        var response = await GetResponseAsync(messages, options, cancellationToken);
        yield return new ChatResponseUpdate(ChatRole.Assistant, response.Text);
    }

    public object? GetService(Type serviceType, object? serviceKey = null) =>
        serviceType?.IsInstanceOfType(this) == true ? this : null;

    public void Dispose() => _http.Dispose();

    private AnthropicRequest BuildRequest(IEnumerable<ChatMessage> messages, ChatOptions? options)
    {
        string? system = null;
        var msgs = new List<AnthropicMessage>();
        foreach (var msg in messages)
        {
            var content = msg.Text;
            if (string.IsNullOrEmpty(content)) continue;
            if (msg.Role == ChatRole.System)
            {
                system = system is null ? content : system + "\n\n" + content;
            }
            else
            {
                var role = msg.Role == ChatRole.Assistant ? "assistant" : "user";
                msgs.Add(new AnthropicMessage(role, content));
            }
        }
        return new AnthropicRequest
        {
            Model = options?.ModelId ?? _defaultModel,
            MaxTokens = options?.MaxOutputTokens ?? DefaultMaxTokens,
            System = system,
            Temperature = options?.Temperature,
            Messages = msgs,
        };
    }

    private static string ExtractText(JsonElement root)
    {
        if (!root.TryGetProperty("content", out var content) || content.ValueKind != JsonValueKind.Array)
        {
            return string.Empty;
        }
        var sb = new System.Text.StringBuilder();
        foreach (var block in content.EnumerateArray())
        {
            if (block.TryGetProperty("type", out var t) && t.GetString() == "text" &&
                block.TryGetProperty("text", out var txt))
            {
                sb.Append(txt.GetString());
            }
        }
        return sb.ToString();
    }

    private static string Truncate(string s) => s.Length <= 300 ? s : s[..300];

    private sealed class AnthropicRequest
    {
        [JsonPropertyName("model")] public string Model { get; set; } = string.Empty;
        [JsonPropertyName("max_tokens")] public int MaxTokens { get; set; }
        [JsonPropertyName("system")][JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public string? System { get; set; }
        [JsonPropertyName("temperature")][JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public float? Temperature { get; set; }
        [JsonPropertyName("messages")] public List<AnthropicMessage> Messages { get; set; } = new();
    }

    private sealed record AnthropicMessage(
        [property: JsonPropertyName("role")] string Role,
        [property: JsonPropertyName("content")] string Content);
}
