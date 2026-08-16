package com.company.inventory.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "components")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ComponentItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Auto-generated business identifier (C0001, C0002, ... C10000).
     * Assigned once on creation and never editable by users.
     * Nullable at DDL level only so the column can be added to existing tables;
     * it is always populated by ItemCodeGenerator on create and backfilled on startup.
     * Immutability is enforced in the service layer: the request DTO carries no
     * code and ComponentMapper.updateEntity never writes this field.
     */
    @Column(name = "item_code", unique = true, length = 20)
    private String itemCode;

    @Column(name = "component_name", nullable = false, unique = true, length = 150)
    private String componentName;

    /**
     * The component's classification, as a foreign key into {@code component_categories}.
     *
     * <p>This replaced a free-text {@code category} column. That column is deliberately
     * left in place on existing databases rather than dropped: it is the source the
     * migration reads to populate this key, and keeping it means a rollback to the
     * previous build still finds its data intact. Hibernate no longer maps it, so it
     * simply sits unused.</p>
     *
     * <p>Fetched eagerly because every read path — the component list, the low-stock
     * dashboard panel, the invoice import — immediately needs the category name. The
     * table holds a handful of rows and Hibernate resolves repeats from the persistence
     * context, so a page of components costs one extra query per distinct category
     * rather than one per row.</p>
     *
     * <p>Nullable at DDL level only, so the column can be added to a table that already
     * has rows. The migration gives every existing component a category before anything
     * reads them, and the request DTO requires one, so no new component can be saved
     * without it.</p>
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "category_id", foreignKey = @ForeignKey(name = "fk_components_category"))
    private ComponentCategory category;

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false)
    private Integer minimumQuantity;

    /**
     * Purchase price for one unit, and the sole basis for inventory valuation
     * (stock value = quantity x unitPrice).
     *
     * <p>Nullable on purpose: existing rows predate this column, and a component
     * whose cost is genuinely unknown must contribute nothing to the total rather
     * than silently borrowing a price from elsewhere. Valuation skips nulls, and
     * the dashboard reports how many components are unpriced so the gap is visible
     * instead of hidden inside the total.</p>
     */
    @Column(name = "unit_price", precision = 15, scale = 2)
    private java.math.BigDecimal unitPrice;

    @Column(length = 50)
    private String unit;

    /** Warehouse storage location, e.g. "Rack A-12 / Bin 04". */
    @Column(length = 120)
    private String location;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ComponentStatus status;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
        if (status == null) {
            status = ComponentStatus.ACTIVE;
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
