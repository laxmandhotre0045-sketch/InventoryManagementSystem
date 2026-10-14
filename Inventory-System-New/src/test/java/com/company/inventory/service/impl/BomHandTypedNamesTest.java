package com.company.inventory.service.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.company.inventory.dto.response.BomCheckResponse;
import com.company.inventory.dto.response.BomLineResult;
import com.company.inventory.entity.ComponentCategory;
import com.company.inventory.entity.ComponentItem;
import com.company.inventory.entity.ComponentStatus;
import com.company.inventory.entity.Equipment;
import com.company.inventory.repository.ComponentRepository;
import com.company.inventory.repository.EquipmentRepository;
import com.company.inventory.service.BomFileParser;

/**
 * BOM lines typed by hand against inventory names typed by hand — both with mistakes.
 * Inventory names are copied verbatim from the real stock list (typos included).
 */
class BomHandTypedNamesTest {

    private BomCheckServiceImpl service;
    private long nextId = 1;
    private final List<ComponentItem> stock = new ArrayList<>();

    private void add(String category, String name, int qty) {
        long id = nextId++;
        stock.add(ComponentItem.builder().id(id).componentName(name).quantity(qty).minimumQuantity(0)
                .category(ComponentCategory.builder().id(id).name(category).build())
                .status(ComponentStatus.ACTIVE).itemCode("C" + (1000 + id)).build());
    }

    @BeforeEach
    void setUp() {
        add("Capacitor", "A03401A- PMOS", 15);              // AO3401A typed with a zero, filed under Capacitor
        add("Diode", "1N4007 rectifire diode", 100);
        add("Diode", "D IN 5819W", 50);                     // 1N5819W typed with a letter I
        add("IC", "TP561023- 3.7-A Boost Converter with 0.5-V Ultra-low Input Voltage", 8);
        add("IC", "LM393P-Dual Comparator", 50);
        add("IC", "KA7805- adj Voltage Regulator,5V to 40V", 50);
        add("IC", "LM358N- Low Power Dual OP-amp", 124);
        add("IC", "AMS1117-REG LINEAR 3.3V", 30);
        add("OP-AMP SOT23", "ADA4807 1ARJZR7", 12);
        add("IC", "LM2596S-3.3 Step-down TO-263- DC-DC Converters", 100);
        add("Crystal Oscillator", "12 Mhz", 50);
        add("Resistor", "ferrite bead 600E 0603", 10);
        add("Resistor", "Ferrite beed", 10);
        add("Fuse", "7 amp 250V", 400);
        add("Diode", "D Red LED", 200);
        add("Capacitor", "CAP 220UF 25V", 100);
        add("Capacitor", "CAP 220UF 50V", 100);
        add("Potentiometer", "10k ohm", 10);
        add("Resistor", "RES 10K", 400);
        add("Transistor", "BC547", 100);
        add("Programmer", "[R256598] Nu-Link Red Upgrade - Standard Programmer and Debugger for Nuvoton ARM/51", 1);

        ComponentRepository repo = mock(ComponentRepository.class);
        when(repo.findAll()).thenReturn(stock);
        EquipmentRepository equipment = mock(EquipmentRepository.class);
        when(equipment.findAll()).thenReturn(List.of(
                Equipment.builder().id(1L).itemCode("E0035").name("W5500").build()));
        service = new BomCheckServiceImpl(new BomFileParser(), repo, equipment);
    }

    private BomLineResult check(String designator, String name) {
        String csv = "Designator,Component Name,Qty\n" + designator + ",\"" + name + "\",1\n";
        BomCheckResponse r = service.check(csv.getBytes(StandardCharsets.UTF_8), "bom.csv", 1);
        return r.getLines().get(0);
    }

    private void expect(String designator, String bomName, String stockName) {
        BomLineResult l = check(designator, bomName);
        assertEquals(stockName, l.getComponentName(), bomName);
    }

    @Test
    void forgivesLookAlikeCharactersInPartNumbers() {
        expect("Q1", "AO3401A", "A03401A- PMOS");
        expect("D1", "IN4007", "1N4007 rectifire diode");
        expect("D2", "1n5819", "D IN 5819W");
        expect("U1", "TPS61023DRLR", "TP561023- 3.7-A Boost Converter with 0.5-V Ultra-low Input Voltage");
    }

    @Test
    void findsPartNumbersInsideTextAndAcrossSuffixesAndMakers() {
        expect("U1", "LM393DR", "LM393P-Dual Comparator");
        expect("U1", "LM358N IC", "LM358N- Low Power Dual OP-amp");
        expect("U1", "IC 7805", "KA7805- adj Voltage Regulator,5V to 40V");
        expect("Q1", "BC 547 transistor", "BC547");
    }

    @Test
    void readsValuesWrittenAnyWay() {
        expect("", "12 mhz", "12 Mhz");                      // lower-case m is not millihertz
        expect("FB1", "ferite bead 0603", "ferrite bead 600E 0603");
        expect("F1", "Fuse 7A", "7 amp 250V");
        expect("D1", "LED red", "D Red LED");
        expect("RV1", "potentiometer 10 k", "10k ohm");       // a pot, never the fixed 10k resistor
        expect("C1", "220uF 35V", "CAP 220UF 50V");         // 25 V part is too low for 35 V
    }

    @Test
    void doesNotReportLookAlikesAsInStock() {
        assertNull(check("D1", "White LED").getComponentId());
        assertNull(check("U1", "LM2576S-5.0").getComponentId());
        assertNull(check("Q1", "BC548").getComponentId());
        assertNull(check("D1", "1N4001").getComponentId());
        assertNull(check("C1", "1000uF 35V").getComponentId());
        assertNull(check("", "ST-Link programmer").getComponentId(), "ST-Link is not a Nu-Link");
        expect("", "Nu-Link programmer",
                "[R256598] Nu-Link Red Upgrade - Standard Programmer and Debugger for Nuvoton ARM/51");
    }

    @Test
    void wrongVariantIsOnlyASuggestionToVerify() {
        for (String bom : List.of("AMS1117-5.0", "AMS1117-ADJ")) {
            BomLineResult l = check("U1", bom);
            assertEquals("AMS1117-REG LINEAR 3.3V", l.getComponentName(), bom);
            assertEquals("LOW", l.getConfidence(), bom);
            assertEquals("VERIFY", l.getStatus(), bom + " must not count as in stock");
        }
        BomLineResult dual = check("U1", "ADA4807-2ARMZ");
        assertEquals("VERIFY", dual.getStatus(), "the -2 is the dual version");

        BomLineResult ok = check("U1", "AMS1117-3.3");
        assertEquals("AVAILABLE", ok.getStatus(), "same 3.3 V version");
    }

    @Test
    void explainsSpellingDifferencesAndPointsToEquipment() {
        assertTrue(check("Q1", "AO3401A").getNote().contains("Spelling differs"));
        BomLineResult w = check("U1", "W5500");
        assertNull(w.getComponentId());
        assertTrue(w.getNote().contains("E0035"), w.getNote());
    }
}
