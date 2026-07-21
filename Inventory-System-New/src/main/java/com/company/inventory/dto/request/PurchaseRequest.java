package com.company.inventory.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class PurchaseRequest {

    @Schema(description = "Supplier ID")
    private Long supplierId;

    @Schema(description = "Supplier name", example = "ABC Electronics")
    @NotBlank(message = "Supplier name is required")
    @Size(max = 150, message = "Supplier name must be at most 150 characters")
    private String supplierName;

    @Schema(description = "Invoice number", example = "INV-1001")
    @NotBlank(message = "Invoice number is required")
    @Size(max = 120, message = "Invoice number must be at most 120 characters")
    private String invoiceNumber;

    @Schema(description = "Purchase date")
    private LocalDate purchaseDate;

    @Schema(description = "Purchase remarks", example = "Order received from ABC Electronics")
    @Size(max = 1000, message = "Remarks must be at most 1000 characters")
    private String remarks;

    @Schema(description = "Purchase item details")
    @NotEmpty(message = "At least one purchase item is required")
    @Valid
    private List<PurchaseItemRequest> items;
}
