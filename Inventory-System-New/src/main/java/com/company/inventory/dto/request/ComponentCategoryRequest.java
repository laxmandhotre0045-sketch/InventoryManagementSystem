package com.company.inventory.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ComponentCategoryRequest {

    @Schema(description = "Unique category name", example = "Resistor")
    @NotBlank(message = "Category name is required")
    @Size(max = 100, message = "Category name must be at most 100 characters")
    private String name;

    @Schema(description = "Optional description of what belongs in this category",
            example = "Fixed and variable resistors")
    @Size(max = 300, message = "Description must be at most 300 characters")
    private String description;
}
