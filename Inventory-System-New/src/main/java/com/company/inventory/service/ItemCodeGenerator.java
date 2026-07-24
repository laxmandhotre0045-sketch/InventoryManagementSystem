package com.company.inventory.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.company.inventory.repository.ComponentRepository;
import com.company.inventory.repository.EquipmentRepository;

/**
 * Generates sequential, human-readable item codes.
 *
 *   Components -> C0001, C0002, ...
 *   Equipment  -> E0001, E0002, ...
 *
 * The next number is derived from the highest existing numeric suffix, compared
 * numerically (not lexicographically), so the sequence rolls past C9999 to
 * C10000 automatically with no code change. Codes are padded to a minimum of
 * four digits; longer numbers simply print in full.
 *
 * Uniqueness is additionally guaranteed by a unique index on the item_code
 * column, so a duplicate can never be persisted even under contention.
 */
@Service
public class ItemCodeGenerator {

    public static final String COMPONENT_PREFIX = "C";
    public static final String EQUIPMENT_PREFIX = "E";

    /** Minimum digits; the value grows naturally beyond this (e.g. 10000). */
    private static final int MIN_DIGITS = 4;

    private final ComponentRepository componentRepository;
    private final EquipmentRepository equipmentRepository;

    public ItemCodeGenerator(ComponentRepository componentRepository, EquipmentRepository equipmentRepository) {
        this.componentRepository = componentRepository;
        this.equipmentRepository = equipmentRepository;
    }

    /** Next component code, e.g. "C0007". */
    @Transactional(propagation = Propagation.REQUIRED, readOnly = true)
    public synchronized String nextComponentCode() {
        return buildCode(COMPONENT_PREFIX, componentRepository.findMaxItemCodeNumber() + 1);
    }

    /** Next equipment code, e.g. "E0007". */
    @Transactional(propagation = Propagation.REQUIRED, readOnly = true)
    public synchronized String nextEquipmentCode() {
        return buildCode(EQUIPMENT_PREFIX, equipmentRepository.findMaxItemCodeNumber() + 1);
    }

    /** Highest component number currently in use (0 when none exist). */
    public long currentComponentNumber() {
        return componentRepository.findMaxItemCodeNumber();
    }

    /** Highest equipment number currently in use (0 when none exist). */
    public long currentEquipmentNumber() {
        return equipmentRepository.findMaxItemCodeNumber();
    }

    /** Formats a prefix + number into a padded code, e.g. ("C", 7) -> "C0007". */
    public String buildCode(String prefix, long number) {
        return prefix + String.format("%0" + MIN_DIGITS + "d", number);
    }
}
