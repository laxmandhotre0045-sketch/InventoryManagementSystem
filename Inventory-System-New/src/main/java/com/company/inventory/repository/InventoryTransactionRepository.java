package com.company.inventory.repository;

import com.company.inventory.entity.InventoryTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InventoryTransactionRepository extends JpaRepository<InventoryTransaction, Long> {

    Page<InventoryTransaction> findByComponentId(Long componentId, Pageable pageable);


    boolean existsByComponentId(Long componentId);
}
