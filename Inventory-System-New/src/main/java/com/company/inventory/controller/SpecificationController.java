package com.company.inventory.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.company.inventory.dto.response.ApiResponse;
import com.company.inventory.dto.response.SpecificationEntry;
import com.company.inventory.entity.ItemSpecification;
import com.company.inventory.service.SpecificationService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Specifications (name/value rows) of components and equipment. Reading is open to
 * every signed-in user (GET /components/** and /equipment/**); saving needs ADMIN.
 */
@RestController
@Tag(name = "Specifications", description = "View and edit the specifications of components and equipment")
public class SpecificationController {

    private final SpecificationService specificationService;

    public SpecificationController(SpecificationService specificationService) {
        this.specificationService = specificationService;
    }

    @Operation(summary = "Specifications of a component")
    @GetMapping("/components/{id}/specifications")
    public ResponseEntity<ApiResponse<List<SpecificationEntry>>> componentSpecs(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Specifications retrieved",
                specificationService.get(ItemSpecification.COMPONENT, id)));
    }

    @Operation(summary = "Replace the specifications of a component")
    @PutMapping("/components/{id}/specifications")
    public ResponseEntity<ApiResponse<List<SpecificationEntry>>> saveComponentSpecs(
            @PathVariable Long id, @RequestBody List<SpecificationEntry> entries) {
        return ResponseEntity.ok(ApiResponse.success("Specifications saved",
                specificationService.replace(ItemSpecification.COMPONENT, id, entries)));
    }

    @Operation(summary = "Specifications of a piece of equipment")
    @GetMapping("/equipment/{id}/specifications")
    public ResponseEntity<ApiResponse<List<SpecificationEntry>>> equipmentSpecs(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Specifications retrieved",
                specificationService.get(ItemSpecification.EQUIPMENT, id)));
    }

    @Operation(summary = "Replace the specifications of a piece of equipment")
    @PutMapping("/equipment/{id}/specifications")
    public ResponseEntity<ApiResponse<List<SpecificationEntry>>> saveEquipmentSpecs(
            @PathVariable Long id, @RequestBody List<SpecificationEntry> entries) {
        return ResponseEntity.ok(ApiResponse.success("Specifications saved",
                specificationService.replace(ItemSpecification.EQUIPMENT, id, entries)));
    }
}
