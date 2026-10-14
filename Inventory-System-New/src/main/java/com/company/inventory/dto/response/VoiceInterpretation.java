package com.company.inventory.dto.response;

import java.math.BigDecimal;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * The AI's interpretation of a spoken command, plus the system's resolution of it
 * against the real catalogue. Returned by /voice/interpret; nothing is changed in
 * the database at this stage — the user confirms first.
 */
@Data
public class VoiceInterpretation {

    @Schema(description = "True when the command was understood as an inventory action")
    private boolean understood;

    @Schema(description = "ADD_STOCK | REMOVE_STOCK | CREATE_COMPONENT | UNKNOWN", example = "ADD_STOCK")
    private String action;

    @Schema(description = "Item name the AI heard", example = "BC547 Transistor")
    private String itemName;

    @Schema(description = "Quantity the AI heard", example = "50")
    private Integer quantity;

    private String unit;
    private String category;

    @Schema(description = "Free-text specifications the AI heard, if any")
    private String specifications;

    private BigDecimal unitPrice;

    // ---- Resolution against the existing catalogue ----
    @Schema(description = "Matched existing component id, when one was found")
    private Long matchedComponentId;
    private String matchedComponentName;

    @Schema(description = "Current stock of the matched component")
    private Integer currentQuantity;

    @Schema(description = "Where the matched component is kept: Category › Type › Value · Rack",
            example = "Capacitor › SMD › 100nF · Rack A12")
    private String matchedPath;

    // ---- Where a NEW component would be filed (auto-suggested, editable) ----
    @Schema(description = "True when the suggested category does not exist yet")
    private boolean categoryIsNew;

    @Schema(description = "Why this category was suggested")
    private String categoryReason;

    @Schema(description = "Suggested type within the category: SMD, THT or Module", example = "SMD")
    private String type;

    @Schema(description = "Suggested value within the type", example = "100nF")
    private String componentValue;

    @Schema(description = "Category › Type › Value", example = "Sensor › Module › DHT11")
    private String path;

    @Schema(description = "True when ADD_STOCK matched no existing item, so confirming will create it")
    private boolean needsCreate;

    @Schema(description = "Human-readable summary shown in the confirm dialog",
            example = "Add 50 pcs to BC547 Transistor (current stock 120 → 170)?")
    private String confirmationText;

    @Schema(description = "A caution to show the user, e.g. removing more than in stock")
    private String warning;

    private String rawTranscript;
}
