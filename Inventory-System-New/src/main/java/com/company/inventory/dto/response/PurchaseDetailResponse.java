package com.company.inventory.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * Everything one purchase brought in: the purchase itself plus the full details of
 * each component line and each piece of equipment registered from its invoice.
 * Read-only view for the Purchases page.
 */
@Data
public class PurchaseDetailResponse {

    @Schema(description = "The purchase header (supplier, invoice, date, total, invoice file)")
    private PurchaseResponse purchase;

    private List<ComponentLine> components = new ArrayList<>();

    private List<EquipmentLine> equipment = new ArrayList<>();

    /** One purchased component line, with the component's current specification. */
    @Data
    public static class ComponentLine {
        private Long purchaseItemId;

        // ---- what this purchase recorded ----
        @Schema(description = "Quantity bought on this purchase", example = "50")
        private Integer quantityPurchased;
        @Schema(description = "Unit price paid on this purchase", example = "8.20")
        private BigDecimal unitPricePaid;
        private BigDecimal lineTotal;

        // ---- the component's specification ----
        private Long componentId;
        private String itemCode;
        private String componentName;
        private String category;
        @Schema(description = "Sub-type within the category, e.g. SMD", example = "SMD")
        private String type;
        @Schema(description = "Specific value, e.g. 4.7kΩ", example = "4.7kΩ")
        private String value;
        @Schema(description = "Specifications / description")
        private String description;
        private String unit;
        private String location;
        private String rackNo;
        private String status;

        // ---- current stock ----
        @Schema(description = "Stock on hand now (after all later movements)", example = "120")
        private Integer currentStock;
        private Integer minimumQuantity;
        @Schema(description = "The component's current unit price")
        private BigDecimal currentUnitPrice;
    }

    /** One piece of equipment registered from this purchase's invoice. */
    @Data
    public static class EquipmentLine {
        private Long equipmentId;
        private String itemCode;
        private String name;
        private String serialNumber;
        private String category;
        private String manufacturer;
        private String status;
        private String location;
        private LocalDate purchaseDate;
        private LocalDate warrantyExpiry;
        @Schema(description = "Notes / specifications")
        private String notes;
    }
}
