package com.company.inventory.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDate;

@Data
public class RecentPurchaseResponse {

    @Schema(description = "Purchase id", example = "2001")
    private Long id;

    @Schema(description = "Supplier name", example = "Acme Supplies")
    private String supplierName;

    @Schema(description = "Purchase date", example = "2026-05-10")
    private LocalDate purchaseDate;

    @Schema(description = "Total amount", example = "780.50")
    private double totalAmount;
}
