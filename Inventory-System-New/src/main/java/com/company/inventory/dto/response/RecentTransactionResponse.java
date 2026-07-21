package com.company.inventory.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDate;

@Data
public class RecentTransactionResponse {

    @Schema(description = "Transaction id", example = "305")
    private Long id;

    @Schema(description = "Transaction type", example = "ISSUE")
    private String transactionType;

    @Schema(description = "Transaction date", example = "2026-06-05")
    private LocalDate transactionDate;

    @Schema(description = "Quantity changed", example = "15")
    private int quantity;

    @Schema(description = "Component name", example = "Resistor 10k")
    private String componentName;
}
