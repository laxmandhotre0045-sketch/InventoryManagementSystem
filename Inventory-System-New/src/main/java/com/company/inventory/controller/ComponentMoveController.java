package com.company.inventory.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.company.inventory.dto.request.MoveToEquipmentRequest;
import com.company.inventory.dto.request.RelocateComponentsRequest;
import com.company.inventory.dto.response.ApiResponse;
import com.company.inventory.dto.response.ComponentResponse;
import com.company.inventory.dto.response.MoveToEquipmentResult;
import com.company.inventory.service.ComponentMoveService;
import com.company.inventory.service.ComponentPlacementService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/** Move a component that is really equipment into the Equipment register (ADMIN). */
@RestController
@RequestMapping("/components")
@Tag(name = "Components", description = "Component catalogue")
public class ComponentMoveController {

    private final ComponentMoveService moveService;
    private final ComponentPlacementService placementService;

    public ComponentMoveController(ComponentMoveService moveService, ComponentPlacementService placementService) {
        this.moveService = moveService;
        this.placementService = placementService;
    }

    @Operation(summary = "Move components to another Category › Type › Value",
            description = "Only category/type/value change; empty fields keep each component's own.")
    @PostMapping("/relocate")
    public ResponseEntity<ApiResponse<List<ComponentResponse>>> relocate(
            @Valid @RequestBody RelocateComponentsRequest request) {
        List<ComponentResponse> moved = placementService.relocate(request);
        return ResponseEntity.ok(ApiResponse.success("Moved " + moved.size() + " component(s)", moved));
    }

    @Operation(summary = "Move a component to Equipment (one record per unit; component archived, not deleted)",
            description = "Use dryRun=true to preview the equipment records without saving anything.")
    @PostMapping("/{id}/move-to-equipment")
    public ResponseEntity<ApiResponse<MoveToEquipmentResult>> moveToEquipment(
            @PathVariable Long id,
            @RequestParam(value = "dryRun", defaultValue = "false") boolean dryRun,
            @RequestBody(required = false) MoveToEquipmentRequest request) {
        MoveToEquipmentResult result = moveService.moveToEquipment(id, request, dryRun);
        String msg = dryRun ? "Preview — nothing saved"
                : "Moved to Equipment as " + result.getUnits() + " record(s)";
        return ResponseEntity.ok(ApiResponse.success(msg, result));
    }
}
