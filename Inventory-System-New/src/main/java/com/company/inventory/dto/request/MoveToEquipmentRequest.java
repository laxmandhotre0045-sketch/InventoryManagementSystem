package com.company.inventory.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/** Optional overrides when moving a component to equipment; blanks use the suggestion. */
@Data
public class MoveToEquipmentRequest {

    @Schema(description = "Equipment category (default: suggested from the name)", example = "Solar & Power Management")
    private String equipmentCategory;

    @Schema(description = "Manufacturer (default: recognised from the name, else empty)", example = "Elejoy")
    private String manufacturer;

    @Schema(description = "Equipment name (default: the component name without its supplier code)")
    private String name;
}
