package com.company.inventory.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.util.List;

@Data
public class ProjectUsageSummaryResponse {

    @Schema(description = "Project name", example = "Vibration Monitoring")
    private String projectName;

    @Schema(description = "Component usage summary for the project")
    private List<ComponentUsageSummary> components;

    @Data
    public static class ComponentUsageSummary {

        @Schema(description = "Component name", example = "ESP32")
        private String componentName;

        @Schema(description = "Total quantity used", example = "5")
        private Integer quantityUsed;
    }
}
