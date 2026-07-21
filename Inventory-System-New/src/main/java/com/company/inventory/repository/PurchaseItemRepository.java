package com.company.inventory.repository;

import com.company.inventory.entity.PurchaseItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PurchaseItemRepository extends JpaRepository<PurchaseItem, Long> {

    Page<PurchaseItem> findByPurchaseId(Long purchaseId, Pageable pageable);

    boolean existsByComponentId(Long componentId);
}
