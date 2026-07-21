package com.company.inventory.mapper;

import com.company.inventory.dto.response.InventoryTransactionResponse;
import com.company.inventory.entity.InventoryTransaction;
import org.springframework.stereotype.Component;

@Component
public class InventoryTransactionMapper {

    public InventoryTransactionResponse toResponse(InventoryTransaction entity) {
        if (entity == null) {
            return null;
        }

        InventoryTransactionResponse response = new InventoryTransactionResponse();
        response.setId(entity.getId());
        response.setComponentId(entity.getComponent().getId());
        response.setComponentName(entity.getComponent().getComponentName());
        response.setTransactionType(entity.getTransactionType());
        response.setQuantity(entity.getQuantity());
        response.setRemarks(entity.getRemarks());
        response.setTransactionDate(entity.getTransactionDate());
        response.setCreatedBy(entity.getCreatedBy());
        response.setCreatedAt(entity.getCreatedAt());
        response.setUpdatedAt(entity.getUpdatedAt());
        return response;
    }
}
