package com.company.inventory.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class StockInRequest {

    @Schema(description = "Component identifier", example = "1")
    @NotNull(message = "Component ID is required")
    private Long componentId;

    @Schema(description = "Quantity to add to stock", example = "50")
    @NotNull(message = "Quantity is required")
    @Min(value = 1, message = "Quantity must be greater than 0")
    private Integer quantity;

    @Schema(description = "Remarks for stock in", example = "Purchased from supplier ABC")
    @Size(max = 500, message = "Remarks must be at most 500 characters")
    private String remarks;
}
