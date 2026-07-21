package com.company.inventory.service;

import com.company.inventory.dto.request.ProjectRequest;
import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.dto.response.ProjectResponse;

public interface ProjectService {

    ProjectResponse createProject(ProjectRequest request);

    ProjectResponse updateProject(Long id, ProjectRequest request);

    void deleteProject(Long id);

    ProjectResponse getProjectById(Long id);

    PagedResponse<ProjectResponse> getAllProjects(int page, int size, String sortBy, String sortDir);

    PagedResponse<ProjectResponse> searchProjects(String keyword, int page, int size, String sortBy, String sortDir);
}
