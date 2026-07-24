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

    Optional<ComponentItem> findByItemCode(String itemCode);

    List<ComponentItem> findByItemCodeIsNullOrderByIdAsc();

    /**
     * Highest numeric suffix across existing item codes (e.g. "C10000" -> 10000).
     * Compared numerically, so numbering continues correctly past C9999.
     */
    @Query(value = "SELECT COALESCE(MAX(CAST(SUBSTRING(item_code, 2) AS UNSIGNED)), 0) "
            + "FROM components WHERE item_code REGEXP '^C[0-9]+$'", nativeQuery = true)
    long findMaxItemCodeNumber();

    // Current stock value = sum of (on-hand quantity x average purchased unit price) per component.
    @Query(value = "SELECT COALESCE(SUM(c.quantity * p.avg_price), 0) "
            + "FROM components c "
            + "JOIN (SELECT component_id, AVG(unit_price) AS avg_price FROM purchase_items GROUP BY component_id) p "
            + "ON p.component_id = c.id "
            + "WHERE c.status <> 'ARCHIVED'", nativeQuery = true)
    double sumInventoryValue();
}
