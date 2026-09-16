package com.company.inventory.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * A spoken command captured by the browser's speech recognition and sent as text
 * for the AI to interpret. Example transcripts:
 *   "add 50 BC547 transistors"
 *   "remove 10 ESP32 from stock"
 *   "create a new component DHT11 temperature sensor, quantity 20, category Sensors"
 */
@Data
public class VoiceCommandRequest {

    @Schema(description = "Raw transcript of what the user said", example = "add 50 BC547 transistors")
    @NotBlank(message = "Transcript is required")
    @Size(max = 1000, message = "Transcript is too long")
    private String transcript;
}
