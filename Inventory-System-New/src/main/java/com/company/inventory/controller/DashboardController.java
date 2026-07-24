package com.company.inventory.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.company.inventory.dto.response.DashboardSummaryResponse;
import com.company.inventory.dto.response.LowStockResponse;
import com.company.inventory.dto.response.ProjectSummaryResponse;
import com.company.inventory.dto.response.RecentPurchaseResponse;
import com.company.inventory.dto.response.RecentTransactionResponse;
import com.company.inventory.service.DashboardService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
@Tag(name = "Dashboard", description = "Dashboard summary and reports")
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/summary")
    @Operation(summary = "Get dashboard summary metrics")
    public ResponseEntity<DashboardSummaryResponse> getDashboardSummary() {
        return ResponseEntity.ok(dashboardService.getDashboardSummary());
    }

    @GetMapping("/low-stock")
    @Operation(summary = "Get components that are low on stock")
    public ResponseEntity<List<LowStockResponse>> getLowStockComponents() {
        return ResponseEntity.ok(dashboardService.getLowStockComponents());
    }

    @GetMapping("/recent-purchases")
    @Operation(summary = "Get recent purchases")
    public ResponseEntity<List<RecentPurchaseResponse>> getRecentPurchases(
            @RequestParam(defaultValue = "5") int limit) {
        return ResponseEntity.ok(dashboardService.getRecentPurchases(limit));
    }

    @GetMapping("/recent-transactions")
    @Operation(summary = "Get recent inventory transactions")
    public ResponseEntity<List<RecentTransactionResponse>> getRecentTransactions(
            @RequestParam(defaultValue = "5") int limit) {
        return ResponseEntity.ok(dashboardService.getRecentTransactions(limit));
    }

    @GetMapping("/project-summary")
    @Operation(summary = "Get project summary with usage")
    public ResponseEntity<List<ProjectSummaryResponse>> getProjectSummary() {
        return ResponseEntity.ok(dashboardService.getProjectSummary());
    }
}
