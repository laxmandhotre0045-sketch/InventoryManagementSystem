package com.company.inventory.dto.request;

import java.math.BigDecimal;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * The confirmed (and possibly user-edited) voice intent that the user approved in
 * the confirmation step. Applied against the real inventory only on /voice/execute.
 */
@Data
public class VoiceExecuteRequest {

    @Schema(description = "ADD_STOCK | REMOVE_STOCK | CREATE_COMPONENT", example = "ADD_STOCK")
    @NotNull(message = "Action is required")
    private String action;

    @Schema(description = "Existing component id when adding/removing stock of a known item", example = "12")
    private Long componentId;

    @Schema(description = "Component name (used when creating a new component)", example = "BC547 Transistor")
    private String componentName;

    @Schema(description = "Quantity to add / remove / initial stock", example = "50")
    @NotNull(message = "Quantity is required")
    private Integer quantity;

    @Schema(description = "Category name for a new component (resolved or created)", example = "Transistors")
    private String categoryName;

    @Schema(description = "Unit of measure for a new component", example = "pcs")
    private String unit;

    @Schema(description = "Unit price for a new component", example = "1.50")
    private BigDecimal unitPrice;

    @Schema(description = "Minimum stock level for a new component", example = "10")
    private Integer minimumQuantity;

    @Schema(description = "Specifications / description for a new component")
    private String description;

    @Schema(description = "Remarks recorded on the stock transaction")
    private String remarks;
}
