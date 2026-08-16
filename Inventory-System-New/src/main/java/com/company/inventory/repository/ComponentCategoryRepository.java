package com.company.inventory.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.company.inventory.entity.ComponentCategory;

public interface ComponentCategoryRepository extends JpaRepository<ComponentCategory, Long> {

    /**
     * Case-insensitive lookup — the basis of every duplicate check.
     *
     * <p>Used on create, on rename, and by the invoice import when it resolves a
     * category name coming from an extracted document, so "resistor" from any of
     * those paths finds the existing "Resistor" instead of creating a twin.</p>
     */
    Optional<ComponentCategory> findByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCase(String name);

    /** Alphabetical: the order the dropdown and the grouped component list both use. */
    List<ComponentCategory> findAllByOrderByNameAsc();
}
