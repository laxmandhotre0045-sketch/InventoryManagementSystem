package com.company.inventory.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * Where a new item belongs in the inventory: Category › Type › Value. A suggestion —
 * the user sees it before anything is saved and can change it.
 */
@Data
public class ComponentClassification {

    @Schema(description = "Id of the existing category, or null when a new one is suggested")
    private Long categoryId;

    @Schema(description = "Category name", example = "Capacitor")
    private String category;

    @Schema(description = "True when no existing category fits and this name would be created")
    private boolean categoryIsNew;

    @Schema(description = "Type within the category: SMD, THT or Module (null when unknown)", example = "SMD")
    private String type;

    @Schema(description = "Value within the type", example = "100nF")
    private String value;

    @Schema(description = "Category › Type › Value", example = "Capacitor › SMD › 100nF")
    private String path;

    @Schema(description = "Why this category was chosen, for the user to verify")
    private String reason;
}
