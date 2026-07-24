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

    @Schema(description = "Warehouse storage location", example = "Rack A-12 / Bin 04")
    private String location;

    @Schema(description = "Unit of measurement", example = "pcs")
    private String unit;

    @Schema(description = "Most recent supplier for this component", example = "Würth Elektronik")
    private String supplier;

    @Schema(description = "Most recent purchased unit price", example = "0.15")
    private Double lastUnitPrice;
}
