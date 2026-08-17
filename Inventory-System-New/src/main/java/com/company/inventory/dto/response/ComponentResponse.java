package com.company.inventory.dto.response;

import java.time.LocalDateTime;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;


@Data
@Setter
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class ComponentResponse {

    @Schema(description = "Component identifier", example = "1")
    private Long id;

    @Schema(description = "Auto-generated item code", example = "C0001")
    private String itemCode;

    @Schema(description = "Unique component name", example = "ESP32")
    private String componentName;

    /**
     * Category name, kept under the original field name so every existing consumer of
     * this payload — the components table, the dashboard's low-stock panel, any saved
     * export — keeps reading a plain string exactly as before. {@link #categoryId} is
     * the addition that lets a client round-trip the value back into a save.
     */
    @Schema(description = "Category of the component", example = "Resistor")
    private String category;

    @Schema(description = "Id of the component's category", example = "1")
    private Long categoryId;

    @Schema(description = "Quantity available in stock", example = "20")
    private Integer quantity;

    @Schema(description = "Minimum allowable stock level before low stock alert", example = "5")
    private Integer minimumQuantity;

    @Schema(description = "Purchase price for one unit", example = "149.50")
    private java.math.BigDecimal unitPrice;

    /** quantity x unitPrice, or null when the component has no price yet. */
    @Schema(description = "Value of the stock on hand", example = "2990.00")
    private java.math.BigDecimal stockValue;

    @Schema(description = "Unit of measurement", example = "pcs")
    private String unit;

    @Schema(description = "Warehouse storage location", example = "Rack A-12 / Bin 04")
    private String location;

    /** Physical rack label. Free-form and user-entered — see ComponentItem#rackNo. */
    @Schema(description = "Rack number where the component is physically stored", example = "A12")
    private String rackNo;

    @Schema(description = "Component status", example = "ACTIVE")
    private String status;

    @Schema(description = "Component description", example = "32-bit microcontroller for IoT applications")
    private String description;

    @Schema(description = "Record created timestamp")
    private LocalDateTime createdAt;

    @Schema(description = "Record updated timestamp")
    private LocalDateTime updatedAt;
}
