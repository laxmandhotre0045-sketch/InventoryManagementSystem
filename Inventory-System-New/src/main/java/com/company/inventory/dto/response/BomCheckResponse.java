package com.company.inventory.dto.response;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * Result of checking an uploaded BOM against the inventory. Read-only: producing it
 * never changes any data.
 */
@Data
public class BomCheckResponse {

    private String fileName;

    @Schema(description = "Sheet the BOM was read from (Excel only)")
    private String sheetName;

    @Schema(description = "Number of boards the quantities were multiplied by", example = "1")
    private int boards;

    @Schema(description = "Distinct BOM lines checked", example = "42")
    private int totalLines;

    private int availableCount;
    private int partialCount;
    private int toOrderCount;

    @Schema(description = "Lines matched only loosely (confidence LOW) — worth a quick check")
    private int possibleMatchCount;

    @Schema(description = "Lines with status VERIFY: a possible match that must be confirmed before building")
    private int verifyCount;

    @Schema(description = "True when every line is fully covered by stock")
    private boolean readyToBuild;

    @Schema(description = "Which file columns were used for what, e.g. part -> 'MPN'")
    private Map<String, String> detectedColumns = new LinkedHashMap<>();

    @Schema(description = "Non-fatal notes, e.g. rows skipped as DNP")
    private List<String> warnings = new ArrayList<>();

    private List<BomLineResult> lines = new ArrayList<>();
}
