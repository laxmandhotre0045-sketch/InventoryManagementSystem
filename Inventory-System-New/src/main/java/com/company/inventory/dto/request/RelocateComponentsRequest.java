package com.company.inventory.dto.request;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Re-files components under a different Category › Type › Value.
 *
 * <p>Every target field is optional: a field left empty keeps each component's own
 * current value. That is what lets a whole Type be renamed while every component in it
 * keeps its own Value.</p>
 */
@Data
public class RelocateComponentsRequest {

    @Schema(description = "Components to move", example = "[12, 13]")
    @NotEmpty(message = "Choose at least one component to move")
    @Size(max = 500, message = "At most 500 components can be moved at once")
    private List<Long> componentIds;

    @Schema(description = "Existing target category (leave empty to keep the current one)")
    private Long categoryId;

    @Schema(description = "Name of a category to use or create, when categoryId is not given", example = "Capacitor")
    @Size(max = 100, message = "Category name must be at most 100 characters")
    private String newCategoryName;

    @Schema(description = "Target type (leave empty to keep each component's own)", example = "SMD")
    @Size(max = 100, message = "Type must be at most 100 characters")
    private String type;

    @Schema(description = "Target value (leave empty to keep each component's own)", example = "100nF")
    @Size(max = 100, message = "Value must be at most 100 characters")
    private String value;
}
