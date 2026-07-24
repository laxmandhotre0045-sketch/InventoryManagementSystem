package com.company.inventory.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.company.inventory.dto.request.EquipmentRequest;
import com.company.inventory.dto.response.ApiResponse;
import com.company.inventory.dto.response.EquipmentResponse;
import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.service.EquipmentService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/equipment")
@Tag(name = "Equipment Management", description = "Operations for managing equipment records")
public class EquipmentController {

    private final EquipmentService equipmentService;

    public EquipmentController(EquipmentService equipmentService) {
        this.equipmentService = equipmentService;
    }

    @Operation(summary = "Create new equipment record")
    @PostMapping
    public ResponseEntity<ApiResponse<EquipmentResponse>> createEquipment(
            @Valid @RequestBody EquipmentRequest request) {
        EquipmentResponse response = equipmentService.createEquipment(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Equipment created successfully", response));
    }

    @Operation(summary = "Get paged equipment list")
    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<EquipmentResponse>>> getAllEquipment(
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(defaultValue = "") String category,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir) {
        PagedResponse<EquipmentResponse> response = equipmentService.getAllEquipment(keyword, category, status, page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success("Equipment list retrieved successfully", response));
    }

    @Operation(summary = "Get equipment by id")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<EquipmentResponse>> getEquipmentById(
            @Parameter(description = "Equipment identifier", required = true) @PathVariable Long id) {
        EquipmentResponse response = equipmentService.getEquipmentById(id);
        return ResponseEntity.ok(ApiResponse.success("Equipment retrieved successfully", response));
    }

    @Operation(summary = "Update equipment by id")
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<EquipmentResponse>> updateEquipment(
            @Parameter(description = "Equipment identifier", required = true) @PathVariable Long id,
            @Valid @RequestBody EquipmentRequest request) {
        EquipmentResponse response = equipmentService.updateEquipment(id, request);
        return ResponseEntity.ok(ApiResponse.success("Equipment updated successfully", response));
    }

    @Operation(summary = "Delete equipment by id")
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteEquipment(
            @Parameter(description = "Equipment identifier", required = true) @PathVariable Long id) {
        equipmentService.deleteEquipment(id);
        return ResponseEntity.ok(ApiResponse.success("Equipment deleted successfully", null));
    }

    @Operation(summary = "Search equipment records")
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<PagedResponse<EquipmentResponse>>> searchEquipment(
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(defaultValue = "") String category,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir) {
        PagedResponse<EquipmentResponse> response = equipmentService.searchEquipment(keyword, category, status, page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success("Equipment search completed successfully", response));
    }
}
