package com.company.inventory.dto.response;

import com.company.inventory.entity.TransactionType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class InventoryTransactionResponse {

    @Schema(description = "Transaction identifier", example = "1")
    private Long id;

    @Schema(description = "Component identifier", example = "1")
    private Long componentId;

    @Schema(description = "Component name", example = "ESP32")
    private String componentName;

    @Schema(description = "Transaction type", example = "STOCK_IN")
    private TransactionType transactionType;

    @Schema(description = "Quantity transacted", example = "50")
    private Integer quantity;

    @Schema(description = "Transaction remarks", example = "Purchased from supplier")
    private String remarks;

    @Schema(description = "Transaction date")
    private LocalDate transactionDate;

    @Schema(description = "User who created the transaction", example = "admin")
    private String createdBy;

    @Schema(description = "Record created timestamp")
    private LocalDateTime createdAt;

    @Schema(description = "Record updated timestamp")
    private LocalDateTime updatedAt;
}
