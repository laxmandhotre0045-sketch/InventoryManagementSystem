package com.company.inventory.service;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.company.inventory.dto.SupplierDto;
import com.company.inventory.entity.Supplier;
import com.company.inventory.exception.ResourceNotFoundException;
import com.company.inventory.mapper.SupplierMapper;
import com.company.inventory.repository.SupplierRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SupplierService {

    private final SupplierRepository supplierRepository;
    private final SupplierMapper supplierMapper;

    @Transactional(readOnly = true)
    public List<SupplierDto> getAllSuppliers() {
        return supplierRepository.findAll().stream()
                .map(supplierMapper::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public SupplierDto getSupplierById(Long id) {
        Supplier supplier = supplierRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier not found with id: " + id));
        return supplierMapper.toDto(supplier);
    }

    @Transactional
    public SupplierDto createSupplier(SupplierDto supplierDto) {
        Supplier supplier = supplierMapper.toEntity(supplierDto);
        supplier = supplierRepository.save(supplier);
        return supplierMapper.toDto(supplier);
    }

    @Transactional
    public SupplierDto updateSupplier(Long id, SupplierDto supplierDto) {
        Supplier existing = supplierRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier not found with id: " + id));
        
        existing.setSupplierName(supplierDto.getSupplierName());
        existing.setContactPerson(supplierDto.getContactPerson());
        existing.setPhone(supplierDto.getPhone());
        existing.setEmail(supplierDto.getEmail());
        existing.setAddress(supplierDto.getAddress());
        existing.setTaxNumber(supplierDto.getTaxNumber());
        existing.setStatus(supplierDto.getStatus());
        existing.setNotes(supplierDto.getNotes());
        
        existing = supplierRepository.save(existing);
        return supplierMapper.toDto(existing);
    }

    @Transactional
    public void deleteSupplier(Long id) {
        Supplier existing = supplierRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier not found with id: " + id));
        
        existing.setStatus("ARCHIVED");
        supplierRepository.save(existing);
    }
}
