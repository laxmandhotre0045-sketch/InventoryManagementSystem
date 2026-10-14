package com.company.inventory.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One named specification of a component or a piece of equipment, e.g.
 * "Package = SOIC-8", "Supply voltage = 3.3 V", "Datasheet = https://…".
 *
 * <p>A generic name/value table rather than fixed columns: every kind of part has
 * different specifications, and users add their own after importing an item. Linked by
 * {@code itemType} + {@code itemId} so components and equipment share one mechanism.</p>
 */
@Entity
@Table(name = "item_specifications", indexes = @Index(name = "idx_spec_item", columnList = "item_type,item_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ItemSpecification {

    public static final String COMPONENT = "COMPONENT";
    public static final String EQUIPMENT = "EQUIPMENT";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** COMPONENT or EQUIPMENT. */
    @Column(name = "item_type", nullable = false, length = 20)
    private String itemType;

    @Column(name = "item_id", nullable = false)
    private Long itemId;

    @Column(name = "spec_key", nullable = false, length = 100)
    private String specKey;

    @Column(name = "spec_value", length = 1000)
    private String specValue;

    @Column(name = "sort_order")
    private Integer sortOrder;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
