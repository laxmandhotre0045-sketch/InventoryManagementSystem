package com.company.inventory.mapper;

import org.springframework.stereotype.Component;

import com.company.inventory.dto.response.ComponentCategoryResponse;
import com.company.inventory.entity.ComponentCategory;

@Component
public class ComponentCategoryMapper {

    public ComponentCategoryResponse toResponse(ComponentCategory category, long componentCount) {
        if (category == null) {
            return null;
        }
        ComponentCategoryResponse response = new ComponentCategoryResponse();
        response.setId(category.getId());
        response.setName(category.getName());
        response.setDescription(category.getDescription());
        response.setComponentCount(componentCount);
        response.setCreatedAt(category.getCreatedAt());
        response.setUpdatedAt(category.getUpdatedAt());
        return response;
    }
}
