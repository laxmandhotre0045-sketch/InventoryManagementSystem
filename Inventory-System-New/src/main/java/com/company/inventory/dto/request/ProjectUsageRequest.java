package com.company.inventory.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class ProjectUsageRequest {

    @Schema(description = "Project identifier", example = "1")
    @NotNull(message = "Project id is required")
    private Long projectId;

    @Schema(description = "Component identifier", example = "1")
    @NotNull(message = "Component id is required")
    private Long componentId;

    @Schema(description = "Quantity used for the project", example = "5")
    @NotNull(message = "Quantity used is required")
    @Min(value = 1, message = "Quantity used must be greater than 0")
    private Integer quantityUsed;

    @Schema(description = "Usage date")
    private LocalDate usageDate;

    @Schema(description = "Usage remarks", example = "Assigned to vibration sensor assembly")
    @NotBlank(message = "Remarks are required")
    private String remarks;
}
