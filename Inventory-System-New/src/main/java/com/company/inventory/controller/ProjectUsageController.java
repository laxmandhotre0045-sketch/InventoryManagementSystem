package com.company.inventory.controller;

import com.company.inventory.dto.request.ProjectUsageRequest;
import com.company.inventory.dto.response.ApiResponse;
import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.dto.response.ProjectUsageResponse;
import com.company.inventory.service.ProjectComponentUsageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/project-usage")
@Validated
@Tag(name = "Project Component Usage", description = "Record component consumption for projects")
public class ProjectUsageController {

    private final ProjectComponentUsageService projectComponentUsageService;

    public ProjectUsageController(ProjectComponentUsageService projectComponentUsageService) {
        this.projectComponentUsageService = projectComponentUsageService;
    }

    @Operation(summary = "Create a project component usage record")
    @PostMapping
    public ResponseEntity<ApiResponse<ProjectUsageResponse>> createProjectUsage(
            @Valid @RequestBody ProjectUsageRequest request,
            Authentication authentication) {
        String username = authentication != null ? authentication.getName() : "SYSTEM";
        ProjectUsageResponse response = projectComponentUsageService.createProjectUsage(request, username);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Project usage recorded successfully", response));
    }

    @Operation(summary = "Get project usage by id")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ProjectUsageResponse>> getProjectUsageById(
            @Parameter(description = "Project usage identifier", required = true) @PathVariable Long id) {
        ProjectUsageResponse response = projectComponentUsageService.getProjectUsageById(id);
        return ResponseEntity.ok(ApiResponse.success("Project usage retrieved successfully", response));
    }

    @Operation(summary = "Get usage for a project")
    @GetMapping("/project/{projectId}")
    public ResponseEntity<ApiResponse<PagedResponse<ProjectUsageResponse>>> getUsageByProject(
            @Parameter(description = "Project identifier", required = true) @PathVariable Long projectId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "usageDate") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        PagedResponse<ProjectUsageResponse> response = projectComponentUsageService.getUsageByProject(projectId, page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success("Project usage retrieved successfully", response));
    }

    @Operation(summary = "Get usage for a component")
    @GetMapping("/component/{componentId}")
    public ResponseEntity<ApiResponse<PagedResponse<ProjectUsageResponse>>> getUsageByComponent(
            @Parameter(description = "Component identifier", required = true) @PathVariable Long componentId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "usageDate") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        PagedResponse<ProjectUsageResponse> response = projectComponentUsageService.getUsageByComponent(componentId, page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success("Component usage retrieved successfully", response));
    }

    @Operation(summary = "Get paged project usage records")
    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<ProjectUsageResponse>>> getAllProjectUsage(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "usageDate") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        PagedResponse<ProjectUsageResponse> response = projectComponentUsageService.getAllProjectUsage(page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success("Project usage records retrieved successfully", response));
    }

}
