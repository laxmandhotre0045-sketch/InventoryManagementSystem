package com.company.inventory.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.company.inventory.dto.request.AddProjectComponentRequest;
import com.company.inventory.dto.response.ApiResponse;
import com.company.inventory.dto.response.ProjectFolderResponse;
import com.company.inventory.dto.response.PurchaseResponse;
import com.company.inventory.service.impl.ProjectStockService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/** A project's component folder (GET for everyone signed in; changes ADMIN only). */
@RestController
@RequestMapping("/projects/{projectId}")
@Tag(name = "Projects", description = "Project management")
public class ProjectFolderController {

    private final ProjectStockService stockService;

    public ProjectFolderController(ProjectStockService stockService) {
        this.stockService = stockService;
    }

    @Operation(summary = "Project folder: components, quantities, cost summary; keyword searches only this project")
    @GetMapping("/components")
    public ResponseEntity<ApiResponse<ProjectFolderResponse>> folder(
            @PathVariable Long projectId, @RequestParam(required = false) String keyword) {
        return ResponseEntity.ok(ApiResponse.success("Project folder retrieved", stockService.folder(projectId, keyword)));
    }

    @Operation(summary = "Put units of a component into the project folder (BOUGHT adds stock, RESERVED sets existing stock aside)")
    @PostMapping("/components")
    public ResponseEntity<ApiResponse<ProjectFolderResponse>> add(
            @PathVariable Long projectId, @Valid @RequestBody AddProjectComponentRequest request,
            Authentication authentication) {
        String user = authentication != null ? authentication.getName() : "system";
        return ResponseEntity.ok(ApiResponse.success("Added to project", stockService.add(projectId, request, user)));
    }

    @Operation(summary = "Take an entry out of the folder (stock unchanged — the units return to general stock)")
    @DeleteMapping("/components/entries/{entryId}")
    public ResponseEntity<ApiResponse<ProjectFolderResponse>> release(
            @PathVariable Long projectId, @PathVariable Long entryId) {
        return ResponseEntity.ok(ApiResponse.success("Released to general stock", stockService.release(projectId, entryId)));
    }

    @Operation(summary = "Invoices / purchases made for this project")
    @GetMapping("/purchases")
    public ResponseEntity<ApiResponse<List<PurchaseResponse>>> purchases(@PathVariable Long projectId) {
        return ResponseEntity.ok(ApiResponse.success("Project purchases retrieved", stockService.purchases(projectId)));
    }
}
