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
 * A component classification — Resistor, Capacitor, IC, Diode, Transistor, and so on.
 *
 * <p>Categories used to live as free text in {@code components.category}, which let the
 * same category exist under several spellings ("IC", "ic", "I.C.") and made grouping
 * unreliable. They are now rows with their own identity, referenced by components
 * through a foreign key.</p>
 *
 * <p>Uniqueness is enforced in two places on purpose. The unique index is the guarantee —
 * it holds even against concurrent inserts — while the service layer's case-insensitive
 * lookup is what turns a duplicate into a readable message instead of a constraint
 * violation. MySQL's default collation is already case-insensitive, so the index also
 * rejects "resistor" when "Resistor" exists; the service check keeps that behaviour
 * explicit rather than dependent on the server's collation.</p>
 */
@Entity
@Table(name = "component_categories", indexes = {
        @Index(name = "idx_component_categories_name", columnList = "name", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ComponentCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;

    @Column(length = 300)
    private String description;

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
