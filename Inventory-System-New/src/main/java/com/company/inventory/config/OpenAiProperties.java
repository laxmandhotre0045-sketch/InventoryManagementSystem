package com.company.inventory.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration for the OpenAI-backed features (invoice extraction + voice commands).
 *
 * All values are environment-overridable, mirroring the rest of this project's
 * "the .env file is the only thing that changes per environment" convention:
 *
 *   app.openai.api-key   -> OPENAI_API_KEY   (required to actually call OpenAI)
 *   app.openai.model     -> OPENAI_MODEL     (a vision-capable chat model)
 *   app.openai.base-url  -> OPENAI_BASE_URL  (override for Azure/OpenAI-compatible gateways)
 *
 * When the API key is blank the AI features degrade gracefully:
 *   - invoice extraction falls back to the deterministic mock provider,
 *   - voice commands return a clear "not configured" message,
 * so the application always boots and the rest of the system keeps working.
 */
@Component
@ConfigurationProperties(prefix = "app.openai")
public class OpenAiProperties {

    /** OpenAI API key. Blank disables the AI features (graceful fallback). */
    private String apiKey = "";

    /** Chat model used for both vision extraction and voice intent parsing. */
    private String model = "gpt-4o";

    /**
     * Speech-to-text model for voice recordings. gpt-4o-mini-transcribe is more
     * accurate than whisper-1 on short technical commands; whisper-1 is the
     * universally-available fallback used automatically if the primary fails.
     */
    private String transcribeModel = "gpt-4o-mini-transcribe";

    /**
     * Vocabulary hint sent with every transcription to bias it toward the domain —
     * this is what makes "ESP32", "BC547", "DHT11" etc. transcribe correctly
     * instead of being mis-heard as ordinary words.
     */
    private String transcribePrompt = "Voice command for an electronics-components inventory. "
            + "Expect an action and a part name with a quantity. Common parts: ESP32, ESP8266, "
            + "Arduino Uno, Arduino Nano, Raspberry Pi, STM32, BC547 transistor, 2N2222, DHT11 sensor, "
            + "DHT22, HC-SR04 ultrasonic sensor, MPU6050, resistor, capacitor, LED, potentiometer, "
            + "relay, servo motor, breadboard, jumper wires, OLED display, LM358, NE555. "
            + "Example commands: 'add 50 ESP32', 'remove 10 BC547 transistors', "
            + "'create a new component DHT11 sensor quantity 20'.";

    /** API base URL — override for Azure OpenAI or an OpenAI-compatible proxy. */
    private String baseUrl = "https://api.openai.com/v1";

    /** Per-request timeout in milliseconds (vision on a large invoice can be slow). */
    private int timeoutMs = 90000;

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getTranscribeModel() {
        return transcribeModel;
    }

    public void setTranscribeModel(String transcribeModel) {
        this.transcribeModel = transcribeModel;
    }

    public String getTranscribePrompt() {
        return transcribePrompt;
    }

    public void setTranscribePrompt(String transcribePrompt) {
        this.transcribePrompt = transcribePrompt;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        // Normalize: drop a trailing slash so we can safely append "/chat/completions".
        if (baseUrl != null) {
            String b = baseUrl.trim();
            while (b.endsWith("/")) {
                b = b.substring(0, b.length() - 1);
            }
            this.baseUrl = b;
        }
    }

    public int getTimeoutMs() {
        return timeoutMs;
    }

    public void setTimeoutMs(int timeoutMs) {
        this.timeoutMs = timeoutMs;
    }
}
