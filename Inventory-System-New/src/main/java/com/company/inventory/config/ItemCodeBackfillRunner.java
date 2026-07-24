package com.company.inventory.config;

import java.util.List;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.company.inventory.entity.ComponentItem;
import com.company.inventory.entity.Equipment;
import com.company.inventory.repository.ComponentRepository;
import com.company.inventory.repository.EquipmentRepository;
import com.company.inventory.service.ItemCodeGenerator;

import lombok.extern.slf4j.Slf4j;

/**
 * Assigns item codes to records created before the feature existed.
 *
 * Runs once at startup: any row with a NULL item_code receives the next code in
 * sequence, ordered by id so the oldest record gets the lowest number. Once every
 * row has a code this is a no-op, so it is safe on every boot.
 */
@Slf4j
@Component
@Order(20)
public class ItemCodeBackfillRunner implements CommandLineRunner {

    private final ComponentRepository componentRepository;
    private final EquipmentRepository equipmentRepository;
    private final ItemCodeGenerator itemCodeGenerator;

    public ItemCodeBackfillRunner(ComponentRepository componentRepository,
                                  EquipmentRepository equipmentRepository,
                                  ItemCodeGenerator itemCodeGenerator) {
        this.componentRepository = componentRepository;
        this.equipmentRepository = equipmentRepository;
        this.itemCodeGenerator = itemCodeGenerator;
    }

    @Override
    @Transactional
    public void run(String... args) {
        backfillComponents();
        backfillEquipment();
    }

    private void backfillComponents() {
        List<ComponentItem> pending = componentRepository.findByItemCodeIsNullOrderByIdAsc();
        if (pending.isEmpty()) {
            return;
        }
        long next = itemCodeGenerator.currentComponentNumber() + 1;
        for (ComponentItem item : pending) {
            item.setItemCode(itemCodeGenerator.buildCode(ItemCodeGenerator.COMPONENT_PREFIX, next++));
        }
        componentRepository.saveAll(pending);
        log.info("Backfilled item codes for {} component(s)", pending.size());
    }

    private void backfillEquipment() {
        List<Equipment> pending = equipmentRepository.findByItemCodeIsNullOrderByIdAsc();
        if (pending.isEmpty()) {
            return;
        }
        long next = itemCodeGenerator.currentEquipmentNumber() + 1;
        for (Equipment item : pending) {
            item.setItemCode(itemCodeGenerator.buildCode(ItemCodeGenerator.EQUIPMENT_PREFIX, next++));
        }
        equipmentRepository.saveAll(pending);
        log.info("Backfilled item codes for {} equipment record(s)", pending.size());
    }
}
