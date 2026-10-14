package com.company.inventory.service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.company.inventory.dto.response.SpecificationEntry;
import com.company.inventory.entity.ItemSpecification;
import com.company.inventory.exception.ResourceNotFoundException;
import com.company.inventory.repository.ComponentRepository;
import com.company.inventory.repository.EquipmentRepository;
import com.company.inventory.repository.ItemSpecificationRepository;

/**
 * Reads and edits the name/value specifications of components and equipment.
 * Editing replaces the whole list in one transaction, which is how the UI's
 * specification table saves (add, edit, remove and reorder rows, then Save).
 */
@Service
@Transactional
public class SpecificationService {

    public static final int MAX_ENTRIES = 100;
    public static final int MAX_KEY = 100;
    public static final int MAX_VALUE = 1000;

    private final ItemSpecificationRepository repository;
    private final ComponentRepository componentRepository;
    private final EquipmentRepository equipmentRepository;

    public SpecificationService(ItemSpecificationRepository repository,
                                ComponentRepository componentRepository,
                                EquipmentRepository equipmentRepository) {
        this.repository = repository;
        this.componentRepository = componentRepository;
        this.equipmentRepository = equipmentRepository;
    }

    @Transactional(readOnly = true)
    public List<SpecificationEntry> get(String itemType, Long itemId) {
        requireItem(itemType, itemId);
        return toEntries(repository.findByItemTypeAndItemIdOrderBySortOrderAscIdAsc(itemType, itemId));
    }

    /** Replaces every specification of the item with {@code entries} (in the given order). */
    public List<SpecificationEntry> replace(String itemType, Long itemId, List<SpecificationEntry> entries) {
        requireItem(itemType, itemId);
        List<SpecificationEntry> clean = new ArrayList<>();
        if (entries != null) {
            for (SpecificationEntry e : entries) {
                if (e == null || e.getKey() == null || e.getKey().isBlank()) {
                    continue; // an empty row in the editor is not an error
                }
                String key = e.getKey().trim();
                String value = e.getValue() == null ? "" : e.getValue().trim();
                if (key.length() > MAX_KEY) {
                    throw new IllegalArgumentException("Specification name \"" + key.substring(0, 30)
                            + "…\" is longer than " + MAX_KEY + " characters.");
                }
                if (value.length() > MAX_VALUE) {
                    throw new IllegalArgumentException("The value of \"" + key + "\" is longer than "
                            + MAX_VALUE + " characters.");
                }
                clean.add(new SpecificationEntry(key, value));
            }
        }
        if (clean.size() > MAX_ENTRIES) {
            throw new IllegalArgumentException("An item can have at most " + MAX_ENTRIES + " specifications.");
        }
        repository.deleteAllFor(itemType, itemId);
        repository.flush();
        List<ItemSpecification> rows = new ArrayList<>();
        for (int i = 0; i < clean.size(); i++) {
            rows.add(ItemSpecification.builder()
                    .itemType(itemType).itemId(itemId)
                    .specKey(clean.get(i).getKey()).specValue(clean.get(i).getValue())
                    .sortOrder(i).build());
        }
        return toEntries(repository.saveAll(rows));
    }

    /**
     * Adds specifications that the item does not already have (by name, ignoring case).
     * Used when importing, so automatically captured details never overwrite the user's.
     */
    public void addMissing(String itemType, Long itemId, List<SpecificationEntry> entries) {
        if (entries == null || entries.isEmpty()) {
            return;
        }
        List<ItemSpecification> existing = repository.findByItemTypeAndItemIdOrderBySortOrderAscIdAsc(itemType, itemId);
        Set<String> have = new HashSet<>();
        int order = 0;
        for (ItemSpecification s : existing) {
            have.add(s.getSpecKey().toLowerCase(Locale.ROOT));
            order = Math.max(order, s.getSortOrder() == null ? 0 : s.getSortOrder() + 1);
        }
        List<ItemSpecification> add = new ArrayList<>();
        for (SpecificationEntry e : entries) {
            if (e == null || e.getKey() == null || e.getKey().isBlank()
                    || e.getValue() == null || e.getValue().isBlank()) {
                continue;
            }
            String key = truncate(e.getKey().trim(), MAX_KEY);
            if (have.add(key.toLowerCase(Locale.ROOT))) {
                add.add(ItemSpecification.builder().itemType(itemType).itemId(itemId)
                        .specKey(key).specValue(truncate(e.getValue().trim(), MAX_VALUE))
                        .sortOrder(order++).build());
            }
        }
        repository.saveAll(add);
    }

    /** Copies all specifications of one item onto another (missing names only). */
    public void copy(String fromType, Long fromId, String toType, Long toId) {
        addMissing(toType, toId, toEntries(repository.findByItemTypeAndItemIdOrderBySortOrderAscIdAsc(fromType, fromId)));
    }

    /** Removes an item's specifications — used when the item itself is deleted. */
    public void deleteAll(String itemType, Long itemId) {
        repository.deleteAllFor(itemType, itemId);
    }

    private void requireItem(String itemType, Long itemId) {
        boolean exists = switch (itemType) {
            case ItemSpecification.COMPONENT -> componentRepository.existsById(itemId);
            case ItemSpecification.EQUIPMENT -> equipmentRepository.existsById(itemId);
            default -> false;
        };
        if (!exists) {
            throw new ResourceNotFoundException(
                    (ItemSpecification.COMPONENT.equals(itemType) ? "Component" : "Equipment") + " not found with id: " + itemId);
        }
    }

    private static List<SpecificationEntry> toEntries(List<ItemSpecification> rows) {
        List<SpecificationEntry> out = new ArrayList<>();
        for (ItemSpecification s : rows) {
            out.add(new SpecificationEntry(s.getSpecKey(), s.getSpecValue() == null ? "" : s.getSpecValue()));
        }
        return out;
    }

    private static String truncate(String s, int max) {
        return s.length() > max ? s.substring(0, max) : s;
    }
}
