package com.company.inventory.service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.company.inventory.dto.request.RelocateComponentsRequest;
import com.company.inventory.dto.response.ComponentResponse;
import com.company.inventory.entity.ComponentCategory;
import com.company.inventory.entity.ComponentItem;
import com.company.inventory.exception.ResourceNotFoundException;
import com.company.inventory.mapper.ComponentMapper;
import com.company.inventory.repository.ComponentRepository;

/**
 * Moves components to a different Category › Type › Value when they were filed in the
 * wrong place.
 *
 * <p>Only the three placement fields change — stock, price, rack, history and
 * specifications are left exactly as they were. All components move in one transaction,
 * so either every one lands in the new place or none does.</p>
 */
@Service
@Transactional
public class ComponentPlacementService {

    private final ComponentRepository componentRepository;
    private final ComponentCategoryService categoryService;
    private final ComponentMapper componentMapper;

    public ComponentPlacementService(ComponentRepository componentRepository,
                                     ComponentCategoryService categoryService,
                                     ComponentMapper componentMapper) {
        this.componentRepository = componentRepository;
        this.categoryService = categoryService;
        this.componentMapper = componentMapper;
    }

    public List<ComponentResponse> relocate(RelocateComponentsRequest request) {
        String type = trimToNull(request.getType());
        String value = trimToNull(request.getValue());
        ComponentCategory category = null;
        if (request.getCategoryId() != null) {
            category = categoryService.requireById(request.getCategoryId());
        } else if (trimToNull(request.getNewCategoryName()) != null) {
            category = categoryService.resolveOrCreate(request.getNewCategoryName());
        }
        if (category == null && type == null && value == null) {
            throw new IllegalArgumentException("Choose a category, type or value to move to");
        }

        Set<Long> ids = new LinkedHashSet<>(request.getComponentIds());
        List<ComponentItem> items = componentRepository.findAllById(ids);
        if (items.size() != ids.size()) {
            Set<Long> missing = new LinkedHashSet<>(ids);
            items.forEach(i -> missing.remove(i.getId()));
            throw new ResourceNotFoundException("Component not found with id: " + missing);
        }

        List<ComponentResponse> moved = new ArrayList<>();
        for (ComponentItem item : items) {
            if (category != null) item.setCategory(category);
            if (type != null) item.setType(type);
            if (value != null) item.setValue(value);
            moved.add(componentMapper.toResponse(componentRepository.save(item)));
        }
        return moved;
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim().replaceAll("\\s+", " ");
        return t.isEmpty() ? null : t;
    }
}
