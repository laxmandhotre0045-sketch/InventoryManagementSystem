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

    @Schema(description = "True when ADD_STOCK matched no existing item, so confirming will create it")
    private boolean needsCreate;

    @Schema(description = "Human-readable summary shown in the confirm dialog",
            example = "Add 50 pcs to BC547 Transistor (current stock 120 → 170)?")
    private String confirmationText;

    @Schema(description = "A caution to show the user, e.g. removing more than in stock")
    private String warning;

    private String rawTranscript;
}
