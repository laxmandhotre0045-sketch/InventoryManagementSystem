package com.company.inventory.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
public class LowStockResponse {

    @Schema(description = "Component id", example = "101")
    private Long id;

    @Schema(description = "Component name", example = "Resistor 10k")
    private String componentName;

    @Schema(description = "Category name", example = "Passive")
    private String category;

    @Schema(description = "Available quantity", example = "12")
    private int quantity;

    @Schema(description = "Minimum required quantity", example = "20")
    private int minimumQuantity;
}
