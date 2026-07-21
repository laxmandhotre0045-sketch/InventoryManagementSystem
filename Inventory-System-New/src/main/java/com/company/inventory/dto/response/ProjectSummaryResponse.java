package com.company.inventory.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
public class ProjectSummaryResponse {

    @Schema(description = "Project id", example = "11")
    private Long id;

    @Schema(description = "Project name", example = "Bridge Repair")
    private String projectName;

    @Schema(description = "Project status", example = "IN_PROGRESS")
    private String status;

    @Schema(description = "Component usage total quantity", example = "128")
    private int totalComponentUsage;
}
