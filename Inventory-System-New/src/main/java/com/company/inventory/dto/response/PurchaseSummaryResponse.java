package com.company.inventory.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class PurchaseSummaryResponse {

    @Schema(description = "Purchase identifier", example = "1")
    private Long purchaseId;

    @Schema(description = "Supplier name", example = "ABC Electronics")
    private String supplierName;

    @Schema(description = "Invoice number", example = "INV-1001")
    private String invoiceNumber;

    @Schema(description = "Total amount", example = "25000.00")
    private BigDecimal totalAmount;

    @Schema(description = "Purchase item summary")
    private List<PurchaseItemSummary> items;

    @Data
    public static class PurchaseItemSummary {
        @Schema(description = "Component name", example = "ESP32")
        private String componentName;

        @Schema(description = "Quantity purchased", example = "50")
        private Integer quantity;

        @Schema(description = "Unit price", example = "350.00")
        private BigDecimal unitPrice;
    }
}
