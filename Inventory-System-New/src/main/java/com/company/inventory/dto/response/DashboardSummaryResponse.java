package com.company.inventory.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
public class DashboardSummaryResponse {

    @Schema(description = "Total equipment count", example = "120")
    private long totalEquipment;

    @Schema(description = "Total components count", example = "450")
    private long totalComponents;

    @Schema(description = "Total projects count", example = "12")
    private long totalProjects;

    @Schema(description = "Active projects count", example = "5")
    private long activeProjects;

    @Schema(description = "Low stock components count", example = "8")
    private long lowStockComponents;

    @Schema(description = "Total purchases count", example = "45")
    private long totalPurchases;

    @Schema(description = "Out of stock components count", example = "2")
    private long outOfStockComponents;

    @Schema(description = "Total available stock count across all components", example = "1500")
    private long totalAvailableStock;

    @Schema(description = "Total inventory value", example = "125000.50")
    private double totalInventoryValue;

    @Schema(description = "ISO currency code all monetary values are expressed in", example = "INR")
    private String currencyCode;

    @Schema(description = "Purchases this month", example = "12")
    private long purchasesThisMonth;
}
