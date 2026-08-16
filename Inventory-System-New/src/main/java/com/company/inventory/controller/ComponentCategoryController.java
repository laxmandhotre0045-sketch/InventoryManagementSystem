package com.company.inventory.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.company.inventory.dto.request.ComponentCategoryRequest;
import com.company.inventory.dto.response.ApiResponse;
import com.company.inventory.dto.response.ComponentCategoryResponse;
import com.company.inventory.service.ComponentCategoryService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/**
 * Component categories.
 *
 * <p>Reading is open to any signed-in user because the components screen needs the list
 * to render its filter and its form. Creating, renaming and deleting fall under the
 * blanket admin rule in SecurityConfig, so a USER sees categories but cannot change
 * them — the same split the components screen itself already uses.</p>
 */
@RestController
@RequestMapping("/component-categories")
@Validated
@Tag(name = "Component Category Management", description = "Classify components as Resistor, Capacitor, IC, and so on")
public class ComponentCategoryController {

    private final ComponentCategoryService categoryService;

    public ComponentCategoryController(ComponentCategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @Operation(summary = "List all component categories")
    @GetMapping
    public ResponseEntity<ApiResponse<List<ComponentCategoryResponse>>> getAllCategories() {
        List<ComponentCategoryResponse> response = categoryService.getAllCategories();
        return ResponseEntity.ok(ApiResponse.success("Categories retrieved successfully", response));
    }

    @Operation(summary = "Get a category by id")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ComponentCategoryResponse>> getCategoryById(
            @Parameter(description = "Category identifier", required = true) @PathVariable Long id) {
        ComponentCategoryResponse response = categoryService.getCategoryById(id);
        return ResponseEntity.ok(ApiResponse.success("Category retrieved successfully", response));
    }

    @Operation(summary = "Create a component category")
    @PostMapping
    public ResponseEntity<ApiResponse<ComponentCategoryResponse>> createCategory(
            @Valid @RequestBody ComponentCategoryRequest request) {
        ComponentCategoryResponse response = categoryService.createCategory(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Category created successfully", response));
    }

    @Operation(summary = "Rename or describe a category")
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ComponentCategoryResponse>> updateCategory(
            @Parameter(description = "Category identifier", required = true) @PathVariable Long id,
            @Valid @RequestBody ComponentCategoryRequest request) {
        ComponentCategoryResponse response = categoryService.updateCategory(id, request);
        return ResponseEntity.ok(ApiResponse.success("Category updated successfully", response));
    }

    @Operation(summary = "Delete an unused category")
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteCategory(
            @Parameter(description = "Category identifier", required = true) @PathVariable Long id) {
        categoryService.deleteCategory(id);
        return ResponseEntity.ok(ApiResponse.success("Category deleted successfully", null));
    }
}
