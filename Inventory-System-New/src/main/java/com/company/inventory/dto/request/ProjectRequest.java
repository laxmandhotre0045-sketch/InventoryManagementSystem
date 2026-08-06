package com.company.inventory.dto.request;

import com.company.inventory.entity.ProjectPriority;
import com.company.inventory.entity.ProjectStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class ProjectRequest {

    @Schema(description = "Project name", example = "Vibration Monitoring System")
    @NotBlank(message = "Project name is required")
    @Size(max = 150, message = "Project name must be at most 150 characters")
    private String projectName;

    @Schema(description = "Project description", example = "Monitoring vibration levels for industrial equipment")
    @Size(max = 1000, message = "Description must be at most 1000 characters")
    private String description;

    @Schema(description = "Project manager", example = "R. Deshmukh")
    @Size(max = 120, message = "Project manager must be at most 120 characters")
    private String projectManager;

    @Schema(description = "Project start date")
    private LocalDate startDate;

    @Schema(description = "Project end date")
    private LocalDate endDate;

    @Schema(description = "Project status", example = "ACTIVE")
    @NotNull(message = "Project status is required")
    private ProjectStatus status;

    @Schema(description = "Comma-separated team member names", example = "A. Patil, S. Kulkarni")
    @Size(max = 500, message = "Team members must be at most 500 characters")
    private String teamMembers;

    @Schema(description = "Project priority", example = "HIGH")
    private ProjectPriority priority;

    @Schema(description = "Allocated budget", example = "250000.00")
    @PositiveOrZero(message = "Budget cannot be negative")
    private BigDecimal budget;
}
