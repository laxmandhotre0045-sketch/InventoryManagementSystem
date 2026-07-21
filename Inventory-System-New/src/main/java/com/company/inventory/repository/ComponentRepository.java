package com.company.inventory.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import com.company.inventory.entity.ComponentItem;

public interface ComponentRepository extends JpaRepository<ComponentItem, Long>, JpaSpecificationExecutor<ComponentItem> {

    Optional<ComponentItem> findByComponentName(String componentName);

    Page<ComponentItem> findByComponentNameContainingIgnoreCaseOrCategoryContainingIgnoreCase(
            String componentName,
            String category,
            Pageable pageable);

    @Query("select c from ComponentItem c where c.status <> com.company.inventory.entity.ComponentStatus.ARCHIVED and c.quantity > 0 and c.quantity <= c.minimumQuantity")
    List<ComponentItem> findLowStock();

    @Query("select count(c) from ComponentItem c where c.status <> com.company.inventory.entity.ComponentStatus.ARCHIVED and c.quantity > 0 and c.quantity <= c.minimumQuantity")
    long countLowStock();

    @Query("select count(c) from ComponentItem c where c.status <> com.company.inventory.entity.ComponentStatus.ARCHIVED and c.quantity = 0")
    long countOutOfStock();

    @Query("select coalesce(sum(c.quantity), 0) from ComponentItem c where c.status <> com.company.inventory.entity.ComponentStatus.ARCHIVED")
    long sumTotalAvailableStock();

    @Query("select count(c) from ComponentItem c where c.status <> com.company.inventory.entity.ComponentStatus.ARCHIVED")
    long countNonArchived();
}
