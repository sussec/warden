package com.techanv.warden.client.source;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/** Minimal JSON HTTP helper for source-control APIs. Never throws. */
final class Http {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private Http() {}

    // Created lazily so no java.net.http object is captured in the native image
    // heap at build time (jdk.internal.net.http is initialized at run time).
    private static HttpClient client() {
        return HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    record Result(int status, JsonNode body) {}

    static Result send(String method, String url, String headerName, String headerValue, Object body) {
        try {
            byte[] payload = body == null ? new byte[0] : MAPPER.writeValueAsBytes(body);
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(30))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header(headerName, headerValue)
                    .method(method, HttpRequest.BodyPublishers.ofByteArray(payload))
                    .build();
            HttpResponse<byte[]> res = client().send(req, HttpResponse.BodyHandlers.ofByteArray());
            JsonNode node = (res.body() != null && res.body().length > 0)
                    ? MAPPER.readTree(res.body()) : null;
            return new Result(res.statusCode(), node);
        } catch (Exception e) {
            System.err.println("[warden] source-control request failed: " + e.getMessage());
            return new Result(-1, null);
        }
    }
}
