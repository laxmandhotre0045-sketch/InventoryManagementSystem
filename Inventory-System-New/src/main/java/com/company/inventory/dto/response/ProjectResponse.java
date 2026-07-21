package com.company.inventory.dto.response;

import com.company.inventory.entity.ProjectStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class ProjectResponse {

    @Schema(description = "Project identifier", example = "1")
    private Long id;

    @Schema(description = "Project name", example = "Vibration Monitoring System")
    private String projectName;

    @Schema(description = "Project description", example = "Monitoring vibration levels for industrial equipment")
    private String description;

    @Schema(description = "Project start date")
    private LocalDate startDate;

    @Schema(description = "Project end date")
    private LocalDate endDate;

    @Schema(description = "Project status", example = "ACTIVE")
    private ProjectStatus status;

    @Schema(description = "Record created timestamp")
    private LocalDateTime createdAt;

    @Schema(description = "Record updated timestamp")
    private LocalDateTime updatedAt;
}
