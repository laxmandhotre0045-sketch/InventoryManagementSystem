package com.company.inventory.dto.response;

import java.util.ArrayList;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/** What moving a component to equipment did (or, for a dry run, would do). */
@Data
public class MoveToEquipmentResult {

    @Schema(description = "True when nothing was saved — a preview")
    private boolean dryRun;

    private Long componentId;
    private String componentItemCode;
    private String componentName;

    @Schema(description = "How many equipment records (one per unit)", example = "2")
    private int units;

    private String equipmentName;
    private String equipmentCategory;
    private String manufacturer;
    private String location;
    private String status;

    @Schema(description = "Equipment codes created (or planned, for a dry run)")
    private List<String> equipmentCodes = new ArrayList<>();

    private List<Long> equipmentIds = new ArrayList<>();

    @Schema(description = "Specifications given to every new equipment record")
    private List<SpecificationEntry> specifications = new ArrayList<>();
}
