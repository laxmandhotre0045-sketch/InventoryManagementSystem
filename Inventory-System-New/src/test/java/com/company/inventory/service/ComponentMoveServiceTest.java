package com.company.inventory.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.company.inventory.dto.response.MoveToEquipmentResult;
import com.company.inventory.entity.ComponentItem;
import com.company.inventory.entity.ComponentStatus;
import com.company.inventory.entity.Equipment;
import com.company.inventory.entity.ItemSpecification;
import com.company.inventory.repository.ComponentRepository;
import com.company.inventory.repository.EquipmentRepository;

class ComponentMoveServiceTest {

    private ComponentRepository componentRepo;
    private EquipmentRepository equipmentRepo;
    private SpecificationService specs;
    private ComponentMoveService service;

    @BeforeEach
    void setUp() {
        componentRepo = mock(ComponentRepository.class);
        equipmentRepo = mock(EquipmentRepository.class);
        specs = mock(SpecificationService.class);
        when(specs.get(any(), any())).thenReturn(List.of());
        when(equipmentRepo.findMaxItemCodeNumber()).thenReturn(0L);
        AtomicLong ids = new AtomicLong(100);
        when(equipmentRepo.save(any(Equipment.class))).thenAnswer(inv -> {
            Equipment e = inv.getArgument(0);
            e.setId(ids.incrementAndGet());
            return e;
        });
        service = new ComponentMoveService(componentRepo, equipmentRepo,
                new ItemCodeGenerator(componentRepo, equipmentRepo), specs);
    }

    @Test
    void everyRealModuleLandsInASensibleEquipmentCategory() {
        Map<String, String> expected = Map.ofEntries(
                Map.entry("[165649] White 4S 100A LiFePO4 Lithium Battery Protection Balance Charging BMS Protection PCB Board", "Solar & Power Management"),
                Map.entry("[183893] Elejoy CN3795 MPPT Solar Photovoltaic Charging Module", "Solar & Power Management"),
                Map.entry("[405563] 250W High Power Constant voltage Current Adjustable Aluminum Substrate LED Driver Module", "Power Modules"),
                Map.entry("[890185] Elejoy CN3791 12V MPPT Solar Charger Module", "Solar & Power Management"),
                Map.entry("[R22869] High Power Solar Control Circuit Board with Cable", "Solar & Power Management"),
                Map.entry("[R22890] Solar Light Circuit Control Board 3-24V Enhanced", "Solar & Power Management"),
                Map.entry("[R260379] 3S MPPT Solar Panel Controller Solar Power Manager Module", "Solar & Power Management"),
                Map.entry("24 GHZ radar sensor", "Sensor Modules"),
                Map.entry("DC-DC LM2596-(Buck) voltage regulator", "Power Modules"),
                Map.entry("ESP32 S3 ETH", "Communication & IoT Modules"),
                Map.entry("QUECTEL EC200 U-CN", "Communication & IoT Modules"),
                Map.entry("QUICTEL IC", "Communication & IoT Modules"),
                Map.entry("RF CARD", "Communication & IoT Modules"),
                Map.entry("ST LINK V3 MODS", "Programmers & Debuggers"),
                Map.entry("USB ATMEL", "Programmers & Debuggers"),
                Map.entry("USB TO RS485", "Communication & IoT Modules"),
                Map.entry("W5500", "Communication & IoT Modules"));
        expected.forEach((name, cat) -> assertEquals(cat, ComponentMoveService.suggestCategory(name), name));
        assertEquals("Elejoy", ComponentMoveService.suggestManufacturer("[183893] Elejoy CN3795 MPPT"));
        assertEquals("STMicroelectronics", ComponentMoveService.suggestManufacturer("ST LINK V3 MODS"));
    }

    private ComponentItem bms(int qty, ComponentStatus status) {
        return ComponentItem.builder().id(9L).itemCode("C0342")
                .componentName("[165649] White 4S 100A LiFePO4 Lithium Battery Protection Balance Charging BMS Protection PCB Board")
                .quantity(qty).minimumQuantity(0).unitPrice(new BigDecimal("253.39")).status(status).build();
    }

    @Test
    void dryRunPlansOneRecordPerUnitAndWritesNothing() {
        when(componentRepo.findById(9L)).thenReturn(Optional.of(bms(2, ComponentStatus.ACTIVE)));
        MoveToEquipmentResult r = service.moveToEquipment(9L, null, true);

        assertTrue(r.isDryRun());
        assertEquals(2, r.getUnits());
        assertEquals(List.of("E0001", "E0002"), r.getEquipmentCodes());
        assertEquals("White 4S 100A LiFePO4 Lithium Battery Protection Balance Charging BMS Protection PCB Board",
                r.getEquipmentName(), "supplier code stripped from the name");
        assertTrue(r.getSpecifications().stream().anyMatch(s -> s.getKey().equals("Supplier part code")
                && s.getValue().equals("165649")));
        verify(equipmentRepo, never()).save(any());
        verify(componentRepo, never()).save(any());
        verify(specs, never()).addMissing(any(), any(), anyList());
    }

    @Test
    void moveCreatesEachUnitAndArchivesInsteadOfDeleting() {
        ComponentItem c = bms(2, ComponentStatus.ACTIVE);
        when(componentRepo.findById(9L)).thenReturn(Optional.of(c));
        MoveToEquipmentResult r = service.moveToEquipment(9L, null, false);

        assertEquals(2, r.getEquipmentIds().size());
        ArgumentCaptor<Equipment> saved = ArgumentCaptor.forClass(Equipment.class);
        verify(equipmentRepo, times(2)).save(saved.capture());
        assertEquals("Solar & Power Management", saved.getAllValues().get(0).getCategory());
        assertTrue(saved.getAllValues().get(1).getNotes().contains("unit 2 of 2"));
        verify(specs, times(2)).addMissing(eq(ItemSpecification.EQUIPMENT), any(), anyList());

        assertEquals(ComponentStatus.ARCHIVED, c.getStatus(), "component archived, not deleted");
        verify(componentRepo).save(c);
        verify(componentRepo, never()).delete(any(ComponentItem.class));
        verify(componentRepo, never()).deleteById(any());
    }

    @Test
    void refusesArchivedComponentsAndBulkStockParts() {
        when(componentRepo.findById(9L)).thenReturn(Optional.of(bms(2, ComponentStatus.ARCHIVED)));
        assertThrows(IllegalArgumentException.class, () -> service.moveToEquipment(9L, null, false));

        when(componentRepo.findById(9L)).thenReturn(Optional.of(bms(1000, ComponentStatus.ACTIVE)));
        assertThrows(IllegalArgumentException.class, () -> service.moveToEquipment(9L, null, false));
        verify(equipmentRepo, never()).save(any());
    }
}
