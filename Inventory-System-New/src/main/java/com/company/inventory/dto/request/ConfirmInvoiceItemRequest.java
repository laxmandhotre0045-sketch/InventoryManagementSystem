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

    @Schema(description = "Type within the category for a new component (Category › Type › Value)", example = "SMD")
    private String type;

    @Schema(description = "Value within the type for a new component", example = "100nF")
    private String value;

    // ---- Details read off the invoice, saved as specifications of a NEW item ----
    @Schema(description = "Supplier's part code from the invoice", example = "R216425")
    private String supplierItemCode;

    @Schema(description = "HSN / SAC code from the invoice", example = "85423100")
    private String hsnCode;

    @Schema(description = "Package / footprint", example = "SOIC-8")
    private String packageName;

    @Schema(description = "Serial number for a new equipment (optional)")
    private String serialNumber;

    @Schema(description = "Manufacturer for a new equipment (optional)")
    private String manufacturer;

    // ---- quantities (used for component stock-in) ----
    @Schema(description = "Quantity purchased", example = "10")
    private Integer quantity;

    @Schema(description = "Unit price", example = "27.12")
    private BigDecimal unitPrice;

    // ---- which project folder a component line goes into ----
    @Schema(description = "Project folder for this component line; when absent it follows the invoice's project",
            example = "4")
    private Long projectId;

    @Schema(description = "true keeps this component line in general stock, outside any project folder")
    private Boolean generalStock;
}
