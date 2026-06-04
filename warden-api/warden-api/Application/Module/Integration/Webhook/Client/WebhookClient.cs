using System.Text;
using FluentResults;
using Newtonsoft.Json;

namespace Warden.Application.Module.Integration.Webhook.Client
{
    public class WebhookClient(string url, WebhookFormat format = WebhookFormat.Generic, HttpClient? client = null)
    {
        private readonly HttpClient client = client ?? new HttpClient();

        public Task<HttpResponseMessage> PostAsync(WebhookPayload payload)
        {
            var content = format switch
            {
                WebhookFormat.Slack => JsonConvert.SerializeObject(new { text = payload.ToText() }),
                _ => JsonConvert.SerializeObject(payload)
            };
            return client.PostAsync(url, new StringContent(content, Encoding.UTF8, "application/json"));
        }

        public async Task<Result<bool>> TestConnectionAsync()
        {
            var payload = new WebhookPayload
            {
                Event = "test",
                Project = "Test Notification",
                Message = "This is test message"
            };
            try
            {
                var response = await PostAsync(payload);
                if (response.IsSuccessStatusCode)
                {
                    return true;
                }

                return Result.Fail($"Error response status {response.StatusCode}");
            }
            catch (Exception e)
            {
                return Result.Fail(e.Message);
            }
        }
    }
}
