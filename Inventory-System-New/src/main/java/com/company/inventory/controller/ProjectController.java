package com.company.inventory.controller;

import com.company.inventory.dto.request.ProjectRequest;
import com.company.inventory.dto.response.ApiResponse;
import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.dto.response.ProjectResponse;
import com.company.inventory.dto.response.ProjectUsageSummaryResponse;
import com.company.inventory.service.ProjectComponentUsageService;
import com.company.inventory.service.ProjectService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/projects")
@Validated
@Tag(name = "Project Management", description = "Manage projects and track project metadata")
public class ProjectController {

    private final ProjectService projectService;
    private final ProjectComponentUsageService projectComponentUsageService;

    public ProjectController(ProjectService projectService,
                             ProjectComponentUsageService projectComponentUsageService) {
        this.projectService = projectService;
        this.projectComponentUsageService = projectComponentUsageService;
    }

    @Operation(summary = "Create a new project")
    @PostMapping
    public ResponseEntity<ApiResponse<ProjectResponse>> createProject(
            @Valid @RequestBody ProjectRequest request) {
        ProjectResponse response = projectService.createProject(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Project created successfully", response));
    }

    @Operation(summary = "Update an existing project")
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ProjectResponse>> updateProject(
            @Parameter(description = "Project identifier", required = true) @PathVariable Long id,
            @Valid @RequestBody ProjectRequest request) {
        ProjectResponse response = projectService.updateProject(id, request);
        return ResponseEntity.ok(ApiResponse.success("Project updated successfully", response));
    }

    @Operation(summary = "Delete a project")
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteProject(
            @Parameter(description = "Project identifier", required = true) @PathVariable Long id) {
        projectService.deleteProject(id);
        return ResponseEntity.ok(ApiResponse.success("Project deleted successfully", null));
    }

    @Operation(summary = "Get project by id")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ProjectResponse>> getProjectById(
            @Parameter(description = "Project identifier", required = true) @PathVariable Long id) {
        ProjectResponse response = projectService.getProjectById(id);
        return ResponseEntity.ok(ApiResponse.success("Project retrieved successfully", response));
    }

    @Operation(summary = "Get paged project list")
    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<ProjectResponse>>> getAllProjects(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "projectName") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir) {
        PagedResponse<ProjectResponse> response = projectService.getAllProjects(page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success("Projects retrieved successfully", response));
    }

    @Operation(summary = "Get project usage summary")
    @GetMapping("/{projectId}/usage-summary")
    public ResponseEntity<ApiResponse<ProjectUsageSummaryResponse>> getProjectUsageSummary(
            @Parameter(description = "Project identifier", required = true) @PathVariable Long projectId) {
        ProjectUsageSummaryResponse response = projectComponentUsageService.getProjectUsageSummary(projectId);
        return ResponseEntity.ok(ApiResponse.success("Project usage summary retrieved successfully", response));
    }

    @Operation(summary = "Search projects by name")
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<PagedResponse<ProjectResponse>>> searchProjects(
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "projectName") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir) {
        PagedResponse<ProjectResponse> response = projectService.searchProjects(keyword, page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success("Project search completed successfully", response));
    }
}
