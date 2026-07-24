package com.company.inventory.mapper;

import org.springframework.stereotype.Component;

import com.company.inventory.dto.request.ComponentRequest;
import com.company.inventory.dto.response.ComponentResponse;
import com.company.inventory.entity.ComponentItem;

@Component
public class ComponentMapper {

    public ComponentItem toEntity(ComponentRequest request) {
        if (request == null) {
            return null;
        }

        return ComponentItem.builder()
                .componentName(request.getComponentName())
                .category(request.getCategory())
                .quantity(request.getQuantity())
                .minimumQuantity(request.getMinimumQuantity())
                .unit(request.getUnit())
                .location(request.getLocation())
                .description(request.getDescription())
                // Null is fine: @PrePersist defaults a new component to ACTIVE.
                .status(request.getStatus())
                .build();
    }

    public ComponentResponse toResponse(ComponentItem item) {
        if (item == null) {
            return null;
        }
        ComponentResponse response = new ComponentResponse();
        response.setId(item.getId());
        response.setItemCode(item.getItemCode());
        response.setComponentName(item.getComponentName());
        response.setCategory(item.getCategory());
        response.setQuantity(item.getQuantity());
        response.setMinimumQuantity(item.getMinimumQuantity());
        response.setUnit(item.getUnit());
        response.setLocation(item.getLocation());
        response.setStatus(item.getStatus() != null ? item.getStatus().name() : null);
        response.setDescription(item.getDescription());
        response.setCreatedAt(item.getCreatedAt());
        response.setUpdatedAt(item.getUpdatedAt());
        return response;
    }

    public void updateEntity(ComponentRequest request, ComponentItem item) {
        if (request == null || item == null) {
            return;
        }

        item.setComponentName(request.getComponentName());
        item.setCategory(request.getCategory());
        item.setQuantity(request.getQuantity());
        item.setMinimumQuantity(request.getMinimumQuantity());
        item.setUnit(request.getUnit());
        item.setLocation(request.getLocation());
        item.setDescription(request.getDescription());
        // Only overwrite when the client actually sends a status, so existing
        // callers that omit it (and the archive/restore flow) keep working.
        if (request.getStatus() != null) {
            item.setStatus(request.getStatus());
        }
    }
}
