package com.company.inventory.service;

import com.company.inventory.dto.request.ProjectUsageRequest;
import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.dto.response.ProjectUsageResponse;
import com.company.inventory.dto.response.ProjectUsageSummaryResponse;

public interface ProjectComponentUsageService {

    ProjectUsageResponse createProjectUsage(ProjectUsageRequest request, String username);

    ProjectUsageResponse getProjectUsageById(Long id);

    PagedResponse<ProjectUsageResponse> getUsageByProject(Long projectId, int page, int size, String sortBy, String sortDir);

    PagedResponse<ProjectUsageResponse> getUsageByComponent(Long componentId, int page, int size, String sortBy, String sortDir);

    PagedResponse<ProjectUsageResponse> getAllProjectUsage(int page, int size, String sortBy, String sortDir);

    ProjectUsageSummaryResponse getProjectUsageSummary(Long projectId);
}
