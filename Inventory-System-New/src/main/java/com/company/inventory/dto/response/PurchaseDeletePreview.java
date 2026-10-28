package com.company.inventory.dto.response;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/** What deleting a purchase would do, shown before the user confirms. */
@Data
public class PurchaseDeletePreview {

    private Long purchaseId;
    private String invoiceNumber;
    private String supplierName;
    private BigDecimal totalAmount;
    private String projectName;

    @Schema(description = "Project-folder entries that came from this invoice (removed with its components)")
    private int folderEntries;
    @Schema(description = "Equipment registered from this invoice (stays; only its link is cleared)")
    private int equipmentCount;

    @Schema(description = "One row per component bought on this invoice")
    private List<Line> lines = new ArrayList<>();

    @Data
    public static class Line {
        private Long componentId;
        private String componentName;
        @Schema(description = "Units this invoice added")
        private int invoiceQuantity;
        @Schema(description = "Units in stock now")
        private int inStock;
        @Schema(description = "Units that would be taken out (never more than are in stock)")
        private int remove;
        private int stockAfter;
        @Schema(description = "The component exists only because of this invoice and would be archived (restorable)")
        private boolean archive;
    }
}
