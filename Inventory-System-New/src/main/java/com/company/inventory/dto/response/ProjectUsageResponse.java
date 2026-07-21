package com.company.inventory.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class ProjectUsageResponse {

    @Schema(description = "Project usage record identifier", example = "1")
    private Long id;

    @Schema(description = "Project identifier", example = "1")
    private Long projectId;

    @Schema(description = "Project name", example = "Vibration Monitoring System")
    private String projectName;

    @Schema(description = "Component identifier", example = "1")
    private Long componentId;

    @Schema(description = "Component name", example = "ESP32")
    private String componentName;

    @Schema(description = "Quantity used", example = "5")
    private Integer quantityUsed;

    @Schema(description = "Usage date")
    private LocalDate usageDate;

    @Schema(description = "Usage remarks", example = "Assigned to vibration sensor assembly")
    private String remarks;

    @Schema(description = "Record created timestamp")
    private LocalDateTime createdAt;

    @Schema(description = "Record updated timestamp")
    private LocalDateTime updatedAt;
}
