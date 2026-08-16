package com.company.inventory.service;

import java.util.List;

import com.company.inventory.dto.request.ComponentCategoryRequest;
import com.company.inventory.dto.response.ComponentCategoryResponse;
import com.company.inventory.entity.ComponentCategory;

public interface ComponentCategoryService {

    /**
     * Category given to components that arrive without one — currently only from an
     * invoice import whose extracted line carried no category text. Components are
     * never left uncategorised, so the grouped list has no orphan bucket and the
     * category filter can account for every row.
     */
    String UNCATEGORIZED = "Uncategorized";

    List<ComponentCategoryResponse> getAllCategories();

    ComponentCategoryResponse getCategoryById(Long id);

    ComponentCategoryResponse createCategory(ComponentCategoryRequest request);

    ComponentCategoryResponse updateCategory(Long id, ComponentCategoryRequest request);

    /** Refuses to delete a category that still has components pointing at it. */
    void deleteCategory(Long id);

    /** Loads a category by id or fails with a 404 — used when saving a component. */
    ComponentCategory requireById(Long id);

    /**
     * Finds a category by name (case-insensitively) or creates it, falling back to
     * {@link #UNCATEGORIZED} when the name is blank.
     *
     * <p>This is the only entry point that may create a category as a side effect. It
     * exists for the invoice import, where category names arrive as free text from an
     * extracted document; going through the same case-insensitive lookup the UI uses
     * is what stops "resistor" on an invoice from becoming a second Resistor.</p>
     */
    ComponentCategory resolveOrCreate(String name);
}
