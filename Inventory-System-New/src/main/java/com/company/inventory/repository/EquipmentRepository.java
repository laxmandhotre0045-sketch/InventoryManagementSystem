package com.company.inventory.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import com.company.inventory.entity.Equipment;

public interface EquipmentRepository extends JpaRepository<Equipment, Long>, JpaSpecificationExecutor<Equipment> {
    Page<Equipment> findByNameContainingIgnoreCaseOrSerialNumberContainingIgnoreCase(String name, String serialNumber, Pageable pageable);
    long countByStatus(String status);

    Optional<Equipment> findByItemCode(String itemCode);

    List<Equipment> findByItemCodeIsNullOrderByIdAsc();

    /**
     * Highest numeric suffix across existing item codes (e.g. "E10000" -> 10000).
     * Compared numerically, so numbering continues correctly past E9999.
     */
    @Query(value = "SELECT COALESCE(MAX(CAST(SUBSTRING(item_code, 2) AS UNSIGNED)), 0) "
            + "FROM equipment WHERE item_code REGEXP '^E[0-9]+$'", nativeQuery = true)
    long findMaxItemCodeNumber();
}
