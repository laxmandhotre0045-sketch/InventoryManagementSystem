package com.company.inventory.mapper;

import com.company.inventory.dto.request.EquipmentRequest;
import com.company.inventory.dto.response.EquipmentResponse;
import com.company.inventory.entity.Equipment;
import org.springframework.stereotype.Component;

@Component
public class EquipmentMapper {

    public EquipmentResponse toResponse(Equipment equipment) {
        if (equipment == null) {
            return null;
        }

        EquipmentResponse response = new EquipmentResponse();
        response.setId(equipment.getId());
        response.setName(equipment.getName());
        response.setSerialNumber(equipment.getSerialNumber());
        response.setCategory(equipment.getCategory());
        response.setManufacturer(equipment.getManufacturer());
        response.setPurchaseDate(equipment.getPurchaseDate());
        response.setWarrantyExpiry(equipment.getWarrantyExpiry());
        response.setStatus(equipment.getStatus());
        response.setLocation(equipment.getLocation());
        response.setNotes(equipment.getNotes());
        response.setCreatedAt(equipment.getCreatedAt());
        response.setUpdatedAt(equipment.getUpdatedAt());
        return response;
    }

    public Equipment toEntity(EquipmentRequest request) {
        if (request == null) {
            return null;
        }

        return Equipment.builder()
                .name(request.getName())
                .serialNumber(request.getSerialNumber())
                .category(request.getCategory())
                .manufacturer(request.getManufacturer())
                .purchaseDate(request.getPurchaseDate())
                .warrantyExpiry(request.getWarrantyExpiry())
                .status(request.getStatus())
                .location(request.getLocation())
                .notes(request.getNotes())
                .build();
    }

    public void updateEntity(EquipmentRequest request, Equipment equipment) {
        if (request == null || equipment == null) {
            return;
        }

        equipment.setName(request.getName());
        equipment.setSerialNumber(request.getSerialNumber());
        equipment.setCategory(request.getCategory());
        equipment.setManufacturer(request.getManufacturer());
        equipment.setPurchaseDate(request.getPurchaseDate());
        equipment.setWarrantyExpiry(request.getWarrantyExpiry());
        equipment.setStatus(request.getStatus());
        equipment.setLocation(request.getLocation());
        equipment.setNotes(request.getNotes());
    }
}
