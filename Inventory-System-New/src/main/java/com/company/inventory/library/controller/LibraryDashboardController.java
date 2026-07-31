package com.company.inventory.library.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.company.inventory.dto.response.ApiResponse;
import com.company.inventory.library.dto.response.LibraryDashboardResponse;
import com.company.inventory.library.service.LibraryDashboardService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/v1/library/dashboard")
@Tag(name = "Library — Dashboard", description = "Aggregated library metrics and recent activity")
public class LibraryDashboardController {

    private final LibraryDashboardService dashboardService;

    public LibraryDashboardController(LibraryDashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @Operation(summary = "Library dashboard metrics and recent activity")
    @GetMapping
    public ResponseEntity<ApiResponse<LibraryDashboardResponse>> getDashboard() {
        return ResponseEntity.ok(ApiResponse.success("Library dashboard retrieved successfully",
                dashboardService.getDashboard()));
    }
}
