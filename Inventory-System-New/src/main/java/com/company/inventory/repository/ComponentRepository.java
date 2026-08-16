package com.company.inventory.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import com.company.inventory.entity.ComponentItem;
import com.company.inventory.entity.ComponentStatus;

public interface ComponentRepository extends JpaRepository<ComponentItem, Long>, JpaSpecificationExecutor<ComponentItem> {

    Optional<ComponentItem> findByComponentName(String componentName);

    /** Every component in a category, archived included — the delete guard's basis. */
    long countByCategoryId(Long categoryId);

    /** Components a user would actually see in a category; the count shown in the UI. */
    long countByCategoryIdAndStatusNot(Long categoryId, ComponentStatus status);

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

    /**
     * Current stock value = sum of (on-hand quantity x the component's own unit price).
     *
     * <p>Computed live from the two columns that define it, so it is correct by
     * construction: a stock-in raises it, a stock-out lowers it, and editing a unit
     * price re-values that component immediately. Nothing is cached, so the figure
     * can never drift from the data.</p>
     *
     * <p>This replaces an earlier version that averaged {@code purchase_items.unit_price}
     * and applied it to the entire on-hand quantity. That valued stock the user had
     * never priced — the whole quantity of a component was valued as soon as any
     * purchase for it existed — and gave no way to set a cost directly.</p>
     */
    @Query("select coalesce(sum(c.quantity * c.unitPrice), 0) from ComponentItem c "
            + "where c.status <> com.company.inventory.entity.ComponentStatus.ARCHIVED "
            + "and c.unitPrice is not null")
    java.math.BigDecimal sumInventoryValue();

    /** Non-archived components with no unit price — these contribute nothing to the valuation. */
    @Query("select count(c) from ComponentItem c "
            + "where c.status <> com.company.inventory.entity.ComponentStatus.ARCHIVED "
            + "and c.unitPrice is null")
    long countWithoutUnitPrice();
}
