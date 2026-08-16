package com.company.inventory.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class ComponentRequest {

    @Schema(description = "Unique component name", example = "ESP32")
    @NotBlank(message = "Component name is required")
    @Size(max = 150, message = "Component name must be at most 150 characters")
    private String componentName;

    /**
     * Required: every component belongs to exactly one category. The client picks an
     * id from /component-categories rather than typing a name, which is what keeps
     * two spellings of the same category from ever being created through this path.
     */
    @Schema(description = "Id of an existing component category", example = "1")
    @NotNull(message = "Category is required")
    private Long categoryId;

    @Schema(description = "Quantity available in stock", example = "20")
    @NotNull(message = "Quantity is required")
    @Min(value = 0, message = "Quantity cannot be negative")
    private Integer quantity;

    @Schema(description = "Minimum allowable stock level before low stock alert", example = "5")
    @NotNull(message = "Minimum quantity is required")
    @Min(value = 0, message = "Minimum quantity cannot be negative")
    private Integer minimumQuantity;

    /**
     * Purchase price per unit. Optional so existing integrations keep working, but the
     * UI asks for it on create because a component without a price contributes nothing
     * to the inventory valuation.
     */
    @Schema(description = "Purchase price for one unit", example = "149.50")
    @PositiveOrZero(message = "Unit price cannot be negative")
    @Digits(integer = 13, fraction = 2, message = "Unit price must have at most 2 decimal places")
    private BigDecimal unitPrice;

    @Schema(description = "Unit of measurement", example = "pcs")
    @Size(max = 50, message = "Unit must be at most 50 characters")
    private String unit;

    @Schema(description = "Warehouse storage location", example = "Rack A-12 / Bin 04")
    @Size(max = 120, message = "Location must be at most 120 characters")
    private String location;

    /**
     * Optional. When omitted on create the entity defaults to ACTIVE; when omitted
     * on update the existing status is preserved — keeping older clients working.
     */
    @Schema(description = "Component status: ACTIVE = Available, INACTIVE = Not Available "
            + "(ARCHIVED is set by the delete/restore flow, not by clients)",
            example = "ACTIVE",
            allowableValues = { "ACTIVE", "INACTIVE", "ARCHIVED" })
    private com.company.inventory.entity.ComponentStatus status;

    @Schema(description = "Component description", example = "32-bit microcontroller for IoT applications")
    @Size(max = 500, message = "Description must be at most 500 characters")
    private String description;
}
