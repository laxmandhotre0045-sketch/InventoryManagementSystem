package com.company.inventory.service;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import com.company.inventory.config.OpenAiProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;

/**
 * Thin wrapper over the OpenAI Chat Completions REST API.
 *
 * Deliberately uses {@link RestTemplate} (already on the classpath via
 * spring-boot-starter-web) rather than pulling in an SDK — the request shape is
 * small and stable, and this keeps the dependency footprint unchanged.
 *
 * Shared by the invoice-extraction provider (vision) and the voice-command
 * service (text intent parsing). Both ask the model for a strict JSON object via
 * {@code response_format={"type":"json_object"}} and parse the single returned
 * message with Jackson.
 */
@Slf4j
@Service
public class OpenAiClient {

    private final OpenAiProperties props;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    public OpenAiClient(OpenAiProperties props, ObjectMapper objectMapper) {
        this.props = props;
        this.objectMapper = objectMapper;
        this.restTemplate = new RestTemplateBuilderLite(props.getTimeoutMs()).build();
    }

    public boolean isConfigured() {
        return props.isConfigured();
    }

    public String model() {
        return props.getModel();
    }

    /**
     * Runs a single chat completion and returns the assistant message content.
     *
     * @param systemPrompt   the system instruction
     * @param userContent    the user message content — either a plain String, or a
     *                       List of OpenAI "content parts" (for vision: text +
     *                       image_url / file parts)
     * @param jsonMode       when true, requests a strict JSON object response
     * @return the assistant's message content as a String (JSON text when jsonMode)
     */
    public String chat(String systemPrompt, Object userContent, boolean jsonMode) {
        if (!isConfigured()) {
            throw new IllegalStateException("OpenAI is not configured (set OPENAI_API_KEY)");
        }

        Map<String, Object> body = new java.util.HashMap<>();
        body.put("model", props.getModel());
        body.put("temperature", 0);
        body.put("max_tokens", 4096);
        if (jsonMode) {
            body.put("response_format", Map.of("type", "json_object"));
        }
        body.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", userContent)
        ));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(props.getApiKey());

        String url = props.getBaseUrl() + "/chat/completions";
        try {
            String raw = restTemplate.postForObject(url, new HttpEntity<>(body, headers), String.class);
            JsonNode root = objectMapper.readTree(raw);
            JsonNode content = root.path("choices").path(0).path("message").path("content");
            if (content.isMissingNode() || content.isNull()) {
                throw new IllegalStateException("OpenAI returned no message content");
            }
            return content.asText();
        } catch (RestClientException ex) {
            log.error("OpenAI request failed: {}", ex.getMessage());
            throw new IllegalStateException("OpenAI request failed: " + ex.getMessage(), ex);
        } catch (Exception ex) {
            log.error("Could not parse OpenAI response: {}", ex.getMessage());
            throw new IllegalStateException("Could not parse OpenAI response", ex);
        }
    }

    /**
     * Transcribes a recorded audio clip to text via OpenAI's speech-to-text API.
     * Works regardless of browser (unlike the Web Speech API), which is why the
     * frontend records audio and posts it here rather than relying on the browser.
     *
     * @param audio        raw audio bytes (e.g. webm/opus, mp4, wav)
     * @param filename     original filename — its extension helps OpenAI detect the format
     * @param contentType  MIME type of the clip (may be null)
     * @return the transcribed text
     */
    public String transcribe(byte[] audio, String filename, String contentType) {
        if (!isConfigured()) {
            throw new IllegalStateException("OpenAI is not configured (set OPENAI_API_KEY)");
        }
        try {
            return transcribeWith(props.getTranscribeModel(), audio, filename);
        } catch (RestClientException ex) {
            // Primary model may be unavailable on this account — fall back to the
            // universally-available whisper-1 so voice never hard-fails.
            if (!"whisper-1".equalsIgnoreCase(props.getTranscribeModel())) {
                log.warn("Transcription with '{}' failed ({}), retrying with whisper-1",
                        props.getTranscribeModel(), ex.getMessage());
                try {
                    return transcribeWith("whisper-1", audio, filename);
                } catch (Exception inner) {
                    log.error("whisper-1 transcription also failed: {}", inner.getMessage());
                    throw new IllegalStateException("Could not transcribe audio: " + inner.getMessage(), inner);
                }
            }
            throw new IllegalStateException("Could not transcribe audio: " + ex.getMessage(), ex);
        }
    }

    private String transcribeWith(String model, byte[] audio, String filename) {
        final String safeName = (filename == null || filename.isBlank()) ? "audio.webm" : filename;
        ByteArrayResource fileResource = new ByteArrayResource(audio) {
            @Override
            public String getFilename() {
                return safeName;
            }
        };

        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        form.add("file", fileResource);
        form.add("model", model);
        form.add("response_format", "json");
        // Language + a domain vocabulary prompt hugely improve accuracy on short,
        // jargon-heavy commands like "add 50 ESP32".
        form.add("language", "en");
        if (props.getTranscribePrompt() != null && !props.getTranscribePrompt().isBlank()) {
            form.add("prompt", props.getTranscribePrompt());
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        headers.setBearerAuth(props.getApiKey());

        String url = props.getBaseUrl() + "/audio/transcriptions";
        String raw = restTemplate.postForObject(url, new HttpEntity<>(form, headers), String.class);
        try {
            JsonNode root = objectMapper.readTree(raw);
            return root.path("text").asText("");
        } catch (Exception ex) {
            throw new IllegalStateException("Could not read transcription result", ex);
        }
    }

    /** Small helper so we don't depend on Spring Boot's RestTemplateBuilder timeouts wiring. */
    private static final class RestTemplateBuilderLite {
        private final int timeoutMs;

        RestTemplateBuilderLite(int timeoutMs) {
            this.timeoutMs = timeoutMs;
        }

        RestTemplate build() {
            org.springframework.http.client.SimpleClientHttpRequestFactory factory =
                    new org.springframework.http.client.SimpleClientHttpRequestFactory();
            factory.setConnectTimeout((int) Duration.ofMillis(timeoutMs).toMillis());
            factory.setReadTimeout(timeoutMs);
            return new RestTemplate(factory);
        }
    }
}
