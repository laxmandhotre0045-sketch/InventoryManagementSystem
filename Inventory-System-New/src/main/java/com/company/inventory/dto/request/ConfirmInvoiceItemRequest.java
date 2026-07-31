package com.company.inventory.dto.request;

import java.math.BigDecimal;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * One reviewed invoice line the user confirmed, with its chosen resolution.
 */
@Data
public class ConfirmInvoiceItemRequest {

    @Schema(description = "How the user resolved this line")
    @NotNull(message = "Resolution is required for each line")
    private ItemResolution resolution;

    // ---- for EXISTING_* ----
    @Schema(description = "Existing component id (EXISTING_COMPONENT)")
    private Long componentId;

    @Schema(description = "Existing equipment id (EXISTING_EQUIPMENT)")
    private Long equipmentId;

    // ---- for NEW_* ----
    @Schema(description = "Name for a newly created component/equipment", example = "TL431 Voltage Reference")
    private String name;

    @Schema(description = "Category for a new item", example = "Passive Components")
    private String category;

    @Schema(description = "Unit for a new component", example = "pcs")
    private String unit;

    @Schema(description = "Serial number for a new equipment (optional)")
    private String serialNumber;

    @Schema(description = "Manufacturer for a new equipment (optional)")
    private String manufacturer;

    // ---- quantities (used for component stock-in) ----
    @Schema(description = "Quantity purchased", example = "10")
    private Integer quantity;

    @Schema(description = "Unit price", example = "27.12")
    private BigDecimal unitPrice;
}
