package com.company.inventory.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.company.inventory.entity.Equipment;

public interface EquipmentRepository extends JpaRepository<Equipment, Long>, JpaSpecificationExecutor<Equipment> {
    Page<Equipment> findByNameContainingIgnoreCaseOrSerialNumberContainingIgnoreCase(String name, String serialNumber, Pageable pageable);
    long countByStatus(String status);
}
