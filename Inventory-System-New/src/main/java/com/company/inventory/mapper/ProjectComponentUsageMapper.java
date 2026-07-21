package com.company.inventory.mapper;

import com.company.inventory.dto.request.ProjectUsageRequest;
import com.company.inventory.dto.response.ProjectUsageResponse;
import com.company.inventory.entity.ComponentItem;
import com.company.inventory.entity.Project;
import com.company.inventory.entity.ProjectComponentUsage;
import org.springframework.stereotype.Component;

@Component
public class ProjectComponentUsageMapper {

    public ProjectComponentUsage toEntity(ProjectUsageRequest request, Project project, ComponentItem component, String createdBy) {
        if (request == null || project == null || component == null) {
            return null;
        }

        return ProjectComponentUsage.builder()
                .project(project)
                .component(component)
                .quantityUsed(request.getQuantityUsed())
                .remarks(request.getRemarks())
                .usageDate(request.getUsageDate())
                .createdBy(createdBy)
                .build();
    }

    public ProjectUsageResponse toResponse(ProjectComponentUsage usage) {
        if (usage == null) {
            return null;
        }

        ProjectUsageResponse response = new ProjectUsageResponse();
        response.setId(usage.getId());
        response.setProjectId(usage.getProject().getId());
        response.setProjectName(usage.getProject().getProjectName());
        response.setComponentId(usage.getComponent().getId());
        response.setComponentName(usage.getComponent().getComponentName());
        response.setQuantityUsed(usage.getQuantityUsed());
        response.setUsageDate(usage.getUsageDate());
        response.setRemarks(usage.getRemarks());
        response.setCreatedAt(usage.getCreatedAt());
        response.setUpdatedAt(usage.getUpdatedAt());
        return response;
    }
}
