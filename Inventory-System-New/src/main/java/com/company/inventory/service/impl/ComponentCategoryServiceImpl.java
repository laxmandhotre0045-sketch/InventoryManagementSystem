package com.company.inventory.service.impl;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.company.inventory.dto.request.ComponentCategoryRequest;
import com.company.inventory.dto.response.ComponentCategoryResponse;
import com.company.inventory.entity.ComponentCategory;
import com.company.inventory.entity.ComponentStatus;
import com.company.inventory.exception.ResourceInUseException;
import com.company.inventory.exception.ResourceNotFoundException;
import com.company.inventory.mapper.ComponentCategoryMapper;
import com.company.inventory.repository.ComponentCategoryRepository;
import com.company.inventory.repository.ComponentRepository;
import com.company.inventory.service.ComponentCategoryService;

@Service
@Transactional
public class ComponentCategoryServiceImpl implements ComponentCategoryService {

    private final ComponentCategoryRepository categoryRepository;
    private final ComponentRepository componentRepository;
    private final ComponentCategoryMapper categoryMapper;

    public ComponentCategoryServiceImpl(ComponentCategoryRepository categoryRepository,
                                        ComponentRepository componentRepository,
                                        ComponentCategoryMapper categoryMapper) {
        this.categoryRepository = categoryRepository;
        this.componentRepository = componentRepository;
        this.categoryMapper = categoryMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ComponentCategoryResponse> getAllCategories() {
        return categoryRepository.findAllByOrderByNameAsc().stream()
                .map(category -> categoryMapper.toResponse(category, countComponents(category.getId())))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ComponentCategoryResponse getCategoryById(Long id) {
        ComponentCategory category = requireById(id);
        return categoryMapper.toResponse(category, countComponents(id));
    }

    @Override
    public ComponentCategoryResponse createCategory(ComponentCategoryRequest request) {
        String name = normalise(request.getName());
        if (categoryRepository.existsByNameIgnoreCase(name)) {
            throw new IllegalArgumentException("A category named '" + name + "' already exists");
        }

        ComponentCategory saved = categoryRepository.save(ComponentCategory.builder()
                .name(name)
                .description(trimToNull(request.getDescription()))
                .build());
        return categoryMapper.toResponse(saved, 0L);
    }

    @Override
    public ComponentCategoryResponse updateCategory(Long id, ComponentCategoryRequest request) {
        ComponentCategory existing = requireById(id);
        String name = normalise(request.getName());

        // A rename that only changes capitalisation is still the same category, so
        // compare against the one being edited before rejecting the name as taken.
        categoryRepository.findByNameIgnoreCase(name)
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> {
                    throw new IllegalArgumentException("A category named '" + name + "' already exists");
                });

        existing.setName(name);
        existing.setDescription(trimToNull(request.getDescription()));
        ComponentCategory updated = categoryRepository.save(existing);
        return categoryMapper.toResponse(updated, countComponents(id));
    }

    @Override
    public void deleteCategory(Long id) {
        ComponentCategory existing = requireById(id);

        // Counts archived components too. They still hold the foreign key, so deleting
        // the category would either fail on the constraint or strand rows that reappear
        // uncategorised the moment someone restores them.
        long inUse = componentRepository.countByCategoryId(id);
        if (inUse > 0) {
            throw new ResourceInUseException("Cannot delete '" + existing.getName() + "': "
                    + inUse + " component(s) still use it. Move them to another category first.");
        }
        categoryRepository.delete(existing);
    }

    @Override
    @Transactional(readOnly = true)
    public ComponentCategory requireById(Long id) {
        if (id == null) {
            throw new IllegalArgumentException("Category is required");
        }
        return categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category not found with id: " + id));
    }

    @Override
    public ComponentCategory resolveOrCreate(String name) {
        String candidate = trimToNull(name) == null ? UNCATEGORIZED : normalise(name);
        return categoryRepository.findByNameIgnoreCase(candidate)
                .orElseGet(() -> categoryRepository.save(ComponentCategory.builder()
                        .name(candidate)
                        .build()));
    }

    /** Non-archived components only — this is the figure shown next to each category. */
    private long countComponents(Long categoryId) {
        return componentRepository.countByCategoryIdAndStatusNot(categoryId, ComponentStatus.ARCHIVED);
    }

    /**
     * Collapses internal runs of whitespace as well as trimming the ends, so
     * "Power  ICs" and "Power ICs" cannot become two categories that look identical
     * in the dropdown.
     */
    private String normalise(String value) {
        if (value == null) {
            throw new IllegalArgumentException("Category name is required");
        }
        String cleaned = value.trim().replaceAll("\\s+", " ");
        if (cleaned.isEmpty()) {
            throw new IllegalArgumentException("Category name is required");
        }
        return cleaned;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
