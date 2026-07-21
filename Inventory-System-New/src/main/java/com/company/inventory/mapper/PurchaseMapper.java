package com.company.inventory.mapper;

import com.company.inventory.dto.response.PurchaseItemResponse;
import com.company.inventory.dto.response.PurchaseResponse;
import com.company.inventory.entity.Purchase;
import org.springframework.stereotype.Component;

import java.util.stream.Collectors;

@Component
public class PurchaseMapper {

    public PurchaseResponse toResponse(Purchase purchase) {
        if (purchase == null) {
            return null;
        }

        PurchaseResponse response = new PurchaseResponse();
        response.setId(purchase.getId());
        response.setSupplierName(purchase.getSupplierName());
        response.setInvoiceNumber(purchase.getInvoiceNumber());
        response.setPurchaseDate(purchase.getPurchaseDate());
        response.setTotalAmount(purchase.getTotalAmount());
        response.setInvoiceFilePath(purchase.getInvoiceFilePath());
        response.setRemarks(purchase.getRemarks());
        response.setCreatedAt(purchase.getCreatedAt());
        response.setUpdatedAt(purchase.getUpdatedAt());
        response.setItems(purchase.getItems() != null ? purchase.getItems().stream().map(this::toItemResponse).collect(Collectors.toList()) : null);
        return response;
    }

    public PurchaseItemResponse toItemResponse(com.company.inventory.entity.PurchaseItem item) {
        if (item == null) {
            return null;
        }

        PurchaseItemResponse response = new PurchaseItemResponse();
        response.setId(item.getId());
        response.setComponentId(item.getComponent().getId());
        response.setComponentName(item.getComponent().getComponentName());
        response.setQuantity(item.getQuantity());
        response.setUnitPrice(item.getUnitPrice());
        response.setTotalPrice(item.getTotalPrice());
        return response;
    }
}
