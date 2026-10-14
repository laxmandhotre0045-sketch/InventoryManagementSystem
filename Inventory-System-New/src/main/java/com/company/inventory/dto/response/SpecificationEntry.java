package com.company.inventory.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** One specification row: a name and its value. Used for both reading and saving. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SpecificationEntry {

    @Schema(description = "Specification name", example = "Package")
    private String key;

    @Schema(description = "Specification value", example = "SOIC-8")
    private String value;
}
