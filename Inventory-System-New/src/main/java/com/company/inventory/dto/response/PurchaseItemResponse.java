package com.company.inventory.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class PurchaseItemResponse {

    @Schema(description = "Purchase item identifier", example = "1")
    private Long id;

    @Schema(description = "Component identifier", example = "1")
    private Long componentId;

    @Schema(description = "Component name", example = "ESP32")
    private String componentName;

    @Schema(description = "Quantity purchased", example = "50")
    private Integer quantity;

    @Schema(description = "Unit price", example = "350.00")
    private BigDecimal unitPrice;

    @Schema(description = "Total price for this purchase item", example = "17500.00")
    private BigDecimal totalPrice;
}
