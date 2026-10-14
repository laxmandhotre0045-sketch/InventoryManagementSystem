package com.company.inventory.service.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.company.inventory.entity.ComponentCategory;
import com.company.inventory.entity.ComponentItem;
import com.company.inventory.entity.ComponentStatus;

/** The search box's close matches: what a pasted or slightly different text should still find. */
class ComponentSearchCloseMatchTest {

    private final List<ComponentItem> stock = new ArrayList<>();

    private void add(String category, String name) {
        long id = stock.size() + 1;
        stock.add(ComponentItem.builder().id(id).componentName(name).quantity(10).minimumQuantity(0)
                .category(ComponentCategory.builder().id(id).name(category).build())
                .status(ComponentStatus.ACTIVE).itemCode("C" + (1000 + id)).build());
    }

    {
        add("IC", "PCF8563-Real-time clock/calendar(RTC)");
        add("Capacitor", "A03401A- PMOS");
        add("IC", "LM393P-Dual Comparator");
        add("IC", "LM2596S-3.3 Step-down TO-263- DC-DC Converters");
        add("Capacitor", "0.1UF");
        add("Capacitor", "Cap 0.1 uF");
        add("Capacitor", "CAP 22PF");
        add("Resistor", "RES 4K7");
        add("IC", "TL431- Programmable Reference Vref to 36V");
    }

    private List<String> found(String query) {
        return BomMatcher.search(query, stock).stream().map(m -> m.target().c.getComponentName()).toList();
    }

    private String best(String query) {
        List<String> f = found(query);
        assertFalse(f.isEmpty(), "nothing found for " + query);
        return f.get(0);
    }

    @Test
    void pastedFullPartNumbersFindTheStockedPart() {
        assertEquals("PCF8563-Real-time clock/calendar(RTC)", best("pcf8563t"));
        assertEquals("PCF8563-Real-time clock/calendar(RTC)", best("PCF8563T/5,518"));
        assertEquals("LM393P-Dual Comparator", best("LM393DR"));
        assertEquals("TL431- Programmable Reference Vref to 36V", best("TL431AIDBZR"));
        assertEquals("A03401A- PMOS", best("AO3401A"));
    }

    @Test
    void valuesWrittenDifferentlyFindTheSamePart() {
        List<String> f = found("100nF");
        assertTrue(f.containsAll(List.of("0.1UF", "Cap 0.1 uF")), f.toString());
        assertEquals("CAP 22PF", best("22 pf"));
        assertEquals("RES 4K7", best("4.7k"));
    }

    @Test
    void differentPartsAreNotFound() {
        assertTrue(found("LM2576").isEmpty());
        assertTrue(found("PCF8574").isEmpty());
        assertTrue(found("47nF").isEmpty());
    }
}
