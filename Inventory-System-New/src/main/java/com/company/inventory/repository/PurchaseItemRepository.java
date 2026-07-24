package com.company.inventory.repository;

import java.math.BigDecimal;

import com.company.inventory.entity.PurchaseItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PurchaseItemRepository extends JpaRepository<PurchaseItem, Long> {

    Page<PurchaseItem> findByPurchaseId(Long purchaseId, Pageable pageable);

    boolean existsByComponentId(Long componentId);

    // Most recent supplier a component was purchased from (for low-stock reorder hints).
    @Query(value = "SELECT p.supplier_name FROM purchase_items pi "
            + "JOIN purchases p ON p.id = pi.purchase_id "
            + "WHERE pi.component_id = :componentId "
            + "ORDER BY p.purchase_date DESC, p.id DESC LIMIT 1", nativeQuery = true)
    String findLatestSupplierByComponentId(@Param("componentId") Long componentId);

    // Most recent purchased unit price for a component.
    @Query(value = "SELECT pi.unit_price FROM purchase_items pi "
            + "JOIN purchases p ON p.id = pi.purchase_id "
            + "WHERE pi.component_id = :componentId "
            + "ORDER BY p.purchase_date DESC, p.id DESC LIMIT 1", nativeQuery = true)
    BigDecimal findLatestUnitPriceByComponentId(@Param("componentId") Long componentId);
}
