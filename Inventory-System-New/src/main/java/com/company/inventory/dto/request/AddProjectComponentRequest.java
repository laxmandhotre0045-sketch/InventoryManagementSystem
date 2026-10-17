package com.company.inventory.dto.request;

import java.math.BigDecimal;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** Puts units of a component into a project's folder. */
@Data
public class AddProjectComponentRequest {

    @Schema(description = "Inventory component to add", example = "42")
    @NotNull(message = "Choose a component")
    private Long componentId;

    @Schema(description = "Units for the project", example = "100")
    @NotNull(message = "Quantity is required")
    @Min(value = 1, message = "Quantity must be at least 1")
    private Integer quantity;

    @Schema(description = "Price per unit; defaults to the component's current unit price", example = "2.50")
    @PositiveOrZero(message = "Unit price cannot be negative")
    private BigDecimal unitPrice;

    @Schema(description = "BOUGHT = new units bought for the project (stock goes up); "
            + "RESERVED = set aside from existing stock (stock unchanged)", example = "BOUGHT")
    @NotBlank(message = "Choose whether the units were bought or taken from stock")
    @Pattern(regexp = "BOUGHT|RESERVED", message = "Mode must be BOUGHT or RESERVED")
    private String mode;

    @Size(max = 500, message = "Notes must be at most 500 characters")
    private String notes;
}
