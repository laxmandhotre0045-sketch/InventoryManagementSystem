package com.company.inventory.mapper;

import org.springframework.stereotype.Component;

import com.company.inventory.dto.request.ComponentRequest;
import com.company.inventory.dto.response.ComponentResponse;
import com.company.inventory.entity.ComponentCategory;
import com.company.inventory.entity.ComponentItem;

@Component
public class ComponentMapper {

    /**
     * The category arrives already resolved rather than as an id, so the mapper stays a
     * pure translation step and the "does this category exist?" decision lives in the
     * service with the rest of the validation.
     */
    public ComponentItem toEntity(ComponentRequest request, ComponentCategory category) {
        if (request == null) {
            return null;
        }

        return ComponentItem.builder()
                .componentName(request.getComponentName())
                .category(category)
                .quantity(request.getQuantity())
                .minimumQuantity(request.getMinimumQuantity())
                .unitPrice(request.getUnitPrice())
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
        // Flattened to a name and an id: the name keeps every existing consumer of this
        // payload working unchanged, the id lets a client send the value straight back.
        if (item.getCategory() != null) {
            response.setCategory(item.getCategory().getName());
            response.setCategoryId(item.getCategory().getId());
        }
        response.setQuantity(item.getQuantity());
        response.setMinimumQuantity(item.getMinimumQuantity());
        response.setUnitPrice(item.getUnitPrice());
        // Derived here rather than stored, so it can never disagree with quantity x price.
        if (item.getUnitPrice() != null && item.getQuantity() != null) {
            response.setStockValue(item.getUnitPrice()
                    .multiply(java.math.BigDecimal.valueOf(item.getQuantity())));
        }
        response.setUnit(item.getUnit());
        response.setLocation(item.getLocation());
        response.setStatus(item.getStatus() != null ? item.getStatus().name() : null);
        response.setDescription(item.getDescription());
        response.setCreatedAt(item.getCreatedAt());
        response.setUpdatedAt(item.getUpdatedAt());
        return response;
    }

    public void updateEntity(ComponentRequest request, ComponentItem item, ComponentCategory category) {
        if (request == null || item == null) {
            return;
        }

        item.setComponentName(request.getComponentName());
        item.setCategory(category);
        item.setQuantity(request.getQuantity());
        item.setMinimumQuantity(request.getMinimumQuantity());
        // Only overwrite when supplied, so a client that omits the field cannot
        // silently wipe an existing price (and with it, that component's valuation).
        if (request.getUnitPrice() != null) {
            item.setUnitPrice(request.getUnitPrice());
        }
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
