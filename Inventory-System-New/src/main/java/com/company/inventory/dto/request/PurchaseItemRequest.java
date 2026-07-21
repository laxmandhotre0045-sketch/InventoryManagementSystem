package com.company.inventory.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class PurchaseItemRequest {

    @Schema(description = "Component identifier", example = "1")
    @NotNull(message = "Component id is required")
    private Long componentId;

    @Schema(description = "Quantity purchased", example = "50")
    @NotNull(message = "Quantity is required")
    @Min(value = 1, message = "Quantity must be greater than 0")
    private Integer quantity;

    @Schema(description = "Unit price for the component", example = "350.00")
    @NotNull(message = "Unit price is required")
    @DecimalMin(value = "0.00", inclusive = false, message = "Unit price must be greater than 0")
    private BigDecimal unitPrice;
}
