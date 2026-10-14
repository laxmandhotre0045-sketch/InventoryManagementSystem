package com.company.inventory.dto.response;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One BOM line checked against the inventory: what the BOM asks for, the inventory
 * component it matched (if any), and whether stock covers it.
 */
@Data
public class BomLineResult {

    @Schema(description = "Row number in the uploaded file (1-based, as shown in Excel)", example = "5")
    private int rowNumber;

    // ---- What the BOM asked for ----
    @Schema(description = "Part / manufacturer part number from the BOM", example = "TPS61023DRLR")
    private String bomPart;

    @Schema(description = "Name / comment / description text from the BOM", example = "Boost converter")
    private String bomName;

    @Schema(description = "Value column from the BOM", example = "10k")
    private String bomValue;

    @Schema(description = "Footprint / package from the BOM", example = "0805")
    private String bomFootprint;

    @Schema(description = "Designators from the BOM", example = "R1, R2, R5")
    private String designators;

    @Schema(description = "Quantity needed for one board", example = "3")
    private int quantityPerBoard;

    @Schema(description = "Quantity needed for all boards (per-board x boards)", example = "30")
    private int requiredQuantity;

    // ---- Result ----
    @Schema(description = "AVAILABLE | PARTIAL | TO_ORDER | VERIFY (possible match only — confirm before relying on it)",
            example = "AVAILABLE")
    private String status;

    @Schema(description = "How the match was made: EXACT | PART_IN_NAME | SIMILAR_PART | VALUE | WORDS | FUZZY | NONE", example = "EXACT")
    private String matchType;

    @Schema(description = "HIGH | MEDIUM | LOW — LOW means 'possible match, please verify'", example = "HIGH")
    private String confidence;

    @Schema(description = "Units allocated from stock to this line", example = "30")
    private int allocated;

    @Schema(description = "Units that must be ordered for this line", example = "0")
    private int toOrder;

    // ---- Matched inventory component (null when not found) ----
    private Long componentId;
    private String componentName;
    private String itemCode;
    private String category;
    private String type;
    private String value;

    @Schema(description = "Usable stock of the matched component (0 if it is marked Not Available)", example = "120")
    private Integer inStock;

    @Schema(description = "True when the matched component is marked Not Available")
    private boolean componentInactive;

    private String rackNo;
    private String location;
    private BigDecimal unitPrice;

    @Schema(description = "Why the match needs a look, e.g. a spelling or suffix difference, or where a missing part is",
            example = "Ordering/package suffix differs — BOM LM393DR, stock LM393P")
    private String note;

    @Schema(description = "Other close candidates, shown when the match is not certain")
    private List<Alternative> alternatives = new ArrayList<>();

    /** Another inventory component that could be the one the BOM line means. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Alternative {
        private Long componentId;
        private String componentName;
        private Integer inStock;
        private String confidence;
    }
}
