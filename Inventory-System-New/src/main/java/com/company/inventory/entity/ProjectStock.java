package com.company.inventory.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One entry in a project's component folder: "N units of this component belong to this
 * project, at this price".
 *
 * <p>The component itself stays a single inventory record, so it is still listed (and
 * counted) in the main inventory; this entry only says which project the units were
 * bought or set aside for. A component can sit in several projects and in general stock
 * at the same time. Removing an entry never changes stock — the units simply go back to
 * general stock.</p>
 */
@Entity
@Table(name = "project_stock", indexes = {
        @Index(name = "idx_project_stock_project", columnList = "project_id"),
        @Index(name = "idx_project_stock_component", columnList = "component_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProjectStock {

    /** Bought for the project by hand (stock was added). */
    public static final String BOUGHT = "BOUGHT";
    /** Bought for the project through an invoice scanned/uploaded in the project. */
    public static final String INVOICE = "INVOICE";
    /** Set aside from existing general stock (stock unchanged). */
    public static final String RESERVED = "RESERVED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "component_id", nullable = false)
    private ComponentItem component;

    @Column(nullable = false)
    private Integer quantity;

    /** Price per unit paid (or valued at, for reserved stock). */
    @Column(name = "unit_price", precision = 15, scale = 2)
    private BigDecimal unitPrice;

    /** BOUGHT, INVOICE or RESERVED. */
    @Column(nullable = false, length = 20)
    private String source;

    /** The project purchase this came from, when it came from an invoice. */
    @Column(name = "purchase_id")
    private Long purchaseId;

    @Column(length = 500)
    private String notes;

    @Column(name = "created_by", length = 120)
    private String createdBy;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
