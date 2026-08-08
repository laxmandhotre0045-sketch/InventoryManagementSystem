package com.company.inventory.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.company.inventory.dto.request.ComponentRequest;
import com.company.inventory.dto.response.ApiResponse;
import com.company.inventory.dto.response.ComponentResponse;
import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.service.ComponentService;
import com.company.inventory.service.NotificationService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/components")
@Validated
@Tag(name = "Component Management", description = "Manage inventory components used in embedded projects")
public class ComponentController {

    private final ComponentService componentService;
    private final NotificationService notificationService;

    public ComponentController(ComponentService componentService,
                               NotificationService notificationService) {
        this.componentService = componentService;
        this.notificationService = notificationService;
    }

    @Operation(summary = "Create a component")
    @PostMapping
    public ResponseEntity<ApiResponse<ComponentResponse>> createComponent(
            @Valid @RequestBody ComponentRequest request) {
        ComponentResponse response = componentService.createComponent(request);
        notificationService.notifyComponentAdded(response.getId(), response.getItemCode(), response.getComponentName());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Component created successfully", response));
    }

    @Operation(summary = "Get paged component list")
    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<ComponentResponse>>> getAllComponents(
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(defaultValue = "") String category,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "") String stockStatus,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "itemCode") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir) {
        PagedResponse<ComponentResponse> response = componentService.getAllComponents(
                page, size, sortBy, sortDir, keyword, category, status, stockStatus);
        return ResponseEntity.ok(ApiResponse.success("Components retrieved successfully", response));
    }

    @Operation(summary = "Get a component by id")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ComponentResponse>> getComponentById(
            @Parameter(description = "Component identifier", required = true) @PathVariable Long id) {
        ComponentResponse response = componentService.getComponentById(id);
        return ResponseEntity.ok(ApiResponse.success("Component retrieved successfully", response));
    }

    @Operation(summary = "Update a component")
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ComponentResponse>> updateComponent(
            @Parameter(description = "Component identifier", required = true) @PathVariable Long id,
            @Valid @RequestBody ComponentRequest request) {
        ComponentResponse response = componentService.updateComponent(id, request);
        return ResponseEntity.ok(ApiResponse.success("Component updated successfully", response));
    }

    @Operation(summary = "Delete a component")
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteComponent(
            @Parameter(description = "Component identifier", required = true) @PathVariable Long id) {
        componentService.deleteComponent(id);
        return ResponseEntity.ok(ApiResponse.success("Component archived successfully", null));
    }

    @Operation(summary = "Restore an archived component")
    @PostMapping("/{id}/restore")
    public ResponseEntity<ApiResponse<Void>> restoreComponent(
            @Parameter(description = "Component identifier", required = true) @PathVariable Long id) {
        componentService.restoreComponent(id);
        return ResponseEntity.ok(ApiResponse.success("Component restored successfully", null));
    }

    @Operation(summary = "Search components")
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<PagedResponse<ComponentResponse>>> searchComponents(
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(defaultValue = "") String category,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "") String stockStatus,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "itemCode") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir) {
        PagedResponse<ComponentResponse> response = componentService.searchComponents(
                keyword, category, status, stockStatus, page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success("Component search completed successfully", response));
    }

    @Operation(summary = "Get low stock components")
    @GetMapping("/low-stock")
    public ResponseEntity<ApiResponse<List<ComponentResponse>>> getLowStockComponents() {
        List<ComponentResponse> response = componentService.getLowStockComponents();
        return ResponseEntity.ok(ApiResponse.success("Low stock components retrieved successfully", response));
    }
}
