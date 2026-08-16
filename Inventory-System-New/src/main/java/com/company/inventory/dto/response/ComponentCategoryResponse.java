package com.company.inventory.dto.response;

import java.time.LocalDateTime;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ComponentCategoryResponse {

    @Schema(description = "Category identifier", example = "1")
    private Long id;

    @Schema(description = "Unique category name", example = "Resistor")
    private String name;

    @Schema(description = "Optional description", example = "Fixed and variable resistors")
    private String description;

    /**
     * Number of non-archived components in this category. Drives the count beside each
     * option in the UI and tells an admin whether a category is safe to delete.
     */
    @Schema(description = "Non-archived components currently in this category", example = "12")
    private Long componentCount;

    @Schema(description = "Record created timestamp")
    private LocalDateTime createdAt;

    @Schema(description = "Record updated timestamp")
    private LocalDateTime updatedAt;
}
