package com.company.inventory.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.company.inventory.dto.request.UpdateSettingsRequest;
import com.company.inventory.dto.response.ApiResponse;
import com.company.inventory.dto.response.SettingResponse;
import com.company.inventory.service.SettingsService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/settings")
@Tag(name = "Settings", description = "Dynamic, DB-persisted application settings")
public class SettingsController {

    private final SettingsService settingsService;

    public SettingsController(SettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @Operation(summary = "Get all settings grouped by category")
    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, List<SettingResponse>>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success("Settings retrieved successfully", settingsService.getGrouped()));
    }

    @Operation(summary = "Get settings for one category")
    @GetMapping("/{category}")
    public ResponseEntity<ApiResponse<List<SettingResponse>>> getByCategory(@PathVariable String category) {
        return ResponseEntity.ok(ApiResponse.success("Settings retrieved successfully",
                settingsService.getByCategory(category.toUpperCase())));
    }

    @Operation(summary = "Bulk-update settings (admin)")
    @PutMapping
    public ResponseEntity<ApiResponse<Map<String, List<SettingResponse>>>> update(
            @Valid @RequestBody UpdateSettingsRequest request,
            Authentication authentication) {
        String username = authentication != null ? authentication.getName() : "SYSTEM";
        return ResponseEntity.ok(ApiResponse.success("Settings updated successfully",
                settingsService.update(request.getSettings(), username)));
    }
}
