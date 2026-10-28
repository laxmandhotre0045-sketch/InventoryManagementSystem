package com.company.inventory.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/** A deleted purchase waiting in the bin. */
@Data
public class PurchaseBinEntry {

    @Schema(description = "Bin entry id (used to restore it)")
    private Long id;
    private Long purchaseId;
    private String invoiceNumber;
    private String supplierName;
    private BigDecimal totalAmount;
    private LocalDate purchaseDate;
    private int itemCount;
    private String projectName;

    private LocalDateTime deletedAt;
    private String deletedBy;

    @Schema(description = "true when the invoice's components were also taken out of the inventory")
    private boolean componentsRemoved;
    @Schema(description = "Units taken out of stock when it was deleted (put back on restore)")
    private int unitsRemoved;

    @Schema(description = "After this it can no longer be restored")
    private LocalDateTime expiresAt;
    private int daysLeft;
}
