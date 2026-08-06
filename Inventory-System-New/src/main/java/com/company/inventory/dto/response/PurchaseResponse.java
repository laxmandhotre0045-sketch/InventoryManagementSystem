package com.company.inventory.dto.response;

import com.company.inventory.entity.InvoiceProcessingStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class PurchaseResponse {

    @Schema(description = "Purchase identifier", example = "1")
    private Long id;

    @Schema(description = "Supplier name", example = "ABC Electronics")
    private String supplierName;

    @Schema(description = "Invoice number", example = "INV-1001")
    private String invoiceNumber;

    @Schema(description = "Purchase date")
    private LocalDate purchaseDate;

    @Schema(description = "Total amount for the purchase", example = "25000.00")
    private BigDecimal totalAmount;

    @Schema(description = "Invoice file path", example = "uploads/invoices/invoice.pdf")
    private String invoiceFilePath;

    @Schema(description = "Original file name as uploaded", example = "ABC-Electronics-INV-1001.pdf")
    private String invoiceFileOriginalName;

    @Schema(description = "When the invoice document was attached")
    private LocalDateTime invoiceUploadedAt;

    @Schema(description = "Who attached the invoice", example = "admin@sensovibe.com")
    private String invoiceUploadedBy;

    @Schema(description = "Invoice processing status", example = "PROCESSING")
    private InvoiceProcessingStatus invoiceProcessingStatus;

    @Schema(description = "Whether a viewable invoice document is attached", example = "true")
    private boolean hasInvoice;

    @Schema(description = "Purchase remarks", example = "Order received from ABC Electronics")
    private String remarks;

    @Schema(description = "Purchase items")
    private List<PurchaseItemResponse> items;

    @Schema(description = "Record created timestamp")
    private LocalDateTime createdAt;

    @Schema(description = "Record updated timestamp")
    private LocalDateTime updatedAt;
}
