package com.company.inventory.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/** A project's component folder: cost summary plus one row per component. */
@Data
public class ProjectFolderResponse {

    private Long projectId;
    private String projectName;

    // ---- Cost summary (whole folder, not just the rows matching a search) ----
    @Schema(description = "Project budget, if set")
    private BigDecimal budget;

    @Schema(description = "Value of everything in the folder: Σ quantity × unit price")
    private BigDecimal totalCost;

    @Schema(description = "Value of the units already used in the project")
    private BigDecimal usedValue;

    @Schema(description = "Budget minus total cost (null when no budget)")
    private BigDecimal budgetLeft;

    private int componentCount;
    private int unitsInFolder;
    private int unitsUsed;

    @Schema(description = "Invoices recorded for this project and their total")
    private int invoiceCount;
    private BigDecimal invoiceTotal;

    @Schema(description = "Rows (filtered by the search text when one was given)")
    private List<Item> items = new ArrayList<>();

    /** One component in the folder. */
    @Data
    public static class Item {
        private Long componentId;
        private String itemCode;
        private String componentName;
        private String category;
        private String type;
        private String value;
        private String rackNo;
        private String location;
        private String unit;

        @Schema(description = "Units put in the project folder")
        private int allocated;
        @Schema(description = "Units recorded as used in this project")
        private int used;
        @Schema(description = "allocated − used, never below 0")
        private int remaining;
        @Schema(description = "Total stock of this component in the whole inventory")
        private int inStock;

        @Schema(description = "Weighted average price per unit across the folder entries")
        private BigDecimal unitPrice;
        @Schema(description = "Σ quantity × unit price of the folder entries")
        private BigDecimal totalCost;

        @Schema(description = "BOUGHT / INVOICE / RESERVED — where the units came from")
        private List<String> sources = new ArrayList<>();
        private List<Entry> entries = new ArrayList<>();

        @Schema(description = "CLOSE / POSSIBLE when found by a project search without a literal match")
        private String searchMatch;
        private String searchNote;
    }

    /** One addition to the folder (several can exist for the same component). */
    @Data
    public static class Entry {
        private Long id;
        private int quantity;
        private BigDecimal unitPrice;
        private String source;
        private Long purchaseId;
        private String invoiceNumber;
        private String notes;
        private String createdBy;
        private LocalDateTime createdAt;
    }
}
