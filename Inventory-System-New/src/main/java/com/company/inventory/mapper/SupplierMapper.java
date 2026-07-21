package com.company.inventory.mapper;

import org.springframework.stereotype.Component;
import com.company.inventory.dto.SupplierDto;
import com.company.inventory.entity.Supplier;

@Component
public class SupplierMapper {

    public SupplierDto toDto(Supplier supplier) {
        if (supplier == null) {
            return null;
        }
        return SupplierDto.builder()
                .id(supplier.getId())
                .supplierCode(supplier.getSupplierCode())
                .supplierName(supplier.getSupplierName())
                .contactPerson(supplier.getContactPerson())
                .phone(supplier.getPhone())
                .email(supplier.getEmail())
                .address(supplier.getAddress())
                .taxNumber(supplier.getTaxNumber())
                .status(supplier.getStatus())
                .notes(supplier.getNotes())
                .build();
    }

    public Supplier toEntity(SupplierDto dto) {
        if (dto == null) {
            return null;
        }
        return Supplier.builder()
                .id(dto.getId())
                .supplierCode(dto.getSupplierCode())
                .supplierName(dto.getSupplierName())
                .contactPerson(dto.getContactPerson())
                .phone(dto.getPhone())
                .email(dto.getEmail())
                .address(dto.getAddress())
                .taxNumber(dto.getTaxNumber())
                .status(dto.getStatus())
                .notes(dto.getNotes())
                .build();
    }
}
