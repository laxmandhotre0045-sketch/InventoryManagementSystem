package com.company.inventory.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/** Result of applying a confirmed voice command to the inventory. */
@Data
public class VoiceExecutionResult {

    @Schema(description = "The action that was applied", example = "ADD_STOCK")
    private String action;

    private Long componentId;
    private String componentName;

    @Schema(description = "The quantity added or removed (or initial stock on create)", example = "50")
    private Integer quantityChanged;

    @Schema(description = "The component's stock after the operation", example = "170")
    private Integer newQuantity;

    @Schema(description = "User-facing confirmation message")
    private String message;
}
