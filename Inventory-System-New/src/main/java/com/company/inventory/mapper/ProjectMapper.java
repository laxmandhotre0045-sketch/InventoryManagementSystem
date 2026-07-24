package com.company.inventory.mapper;

import com.company.inventory.dto.request.ProjectRequest;
import com.company.inventory.dto.response.ProjectResponse;
import com.company.inventory.entity.Project;
import com.company.inventory.entity.ProjectStatus;
import org.springframework.stereotype.Component;

@Component
public class ProjectMapper {

    public Project toEntity(ProjectRequest request) {
        if (request == null) {
            return null;
        }

        return Project.builder()
                .projectName(request.getProjectName())
                .description(request.getDescription())
                .projectManager(request.getProjectManager())
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .status(request.getStatus() != null ? request.getStatus() : ProjectStatus.ACTIVE)
                .build();
    }

    public ProjectResponse toResponse(Project project) {
        if (project == null) {
            return null;
        }

        ProjectResponse response = new ProjectResponse();
        response.setId(project.getId());
        response.setProjectName(project.getProjectName());
        response.setDescription(project.getDescription());
        response.setProjectManager(project.getProjectManager());
        response.setStartDate(project.getStartDate());
        response.setEndDate(project.getEndDate());
        response.setStatus(project.getStatus());
        response.setCreatedAt(project.getCreatedAt());
        response.setUpdatedAt(project.getUpdatedAt());
        return response;
    }

    public void updateEntity(ProjectRequest request, Project existing) {
        if (request == null || existing == null) {
            return;
        }

        existing.setProjectName(request.getProjectName());
        existing.setDescription(request.getDescription());
        existing.setProjectManager(request.getProjectManager());
        existing.setStartDate(request.getStartDate());
        existing.setEndDate(request.getEndDate());
        existing.setStatus(request.getStatus() != null ? request.getStatus() : ProjectStatus.ACTIVE);
    }
}
