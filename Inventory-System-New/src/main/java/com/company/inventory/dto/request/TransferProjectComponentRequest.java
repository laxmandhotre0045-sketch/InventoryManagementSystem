package com.company.inventory.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** Moves units of a component from one project's folder to another's. */
@Data
public class TransferProjectComponentRequest {

    @Schema(description = "Component in this project's folder", example = "42")
    @NotNull(message = "Choose a component")
    private Long componentId;

    @Schema(description = "Project whose folder receives the units", example = "4")
    @NotNull(message = "Choose the project to move the units to")
    private Long toProjectId;

    @Schema(description = "Units to move; at most what is left (not yet used) in this project", example = "10")
    @NotNull(message = "Quantity is required")
    @Min(value = 1, message = "Quantity must be at least 1")
    private Integer quantity;

    @Size(max = 200, message = "Notes must be at most 200 characters")
    private String notes;
}
