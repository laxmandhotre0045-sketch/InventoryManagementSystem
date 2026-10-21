package com.company.inventory.service.impl;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.stream.Collectors;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.company.inventory.entity.ComponentCategory;
import com.company.inventory.entity.ComponentItem;

/**
 * "Is this invoice line a part already in stock?" — names and rules taken from a real Robu
 * invoice (SO289050) checked against the real inventory. A SURE match is pre-selected and
 * adds to that component's quantity, so it must never pair different parts.
 */
class InvoiceLineMatcherTest {

    private static long ids = 1;

    private static ComponentItem item(String category, String type, String name) {
        return ComponentItem.builder().id(ids++).componentName(name).type(type).quantity(200)
                .category(ComponentCategory.builder().name(category).build()).build();
    }

    private static final List<BomMatcher.Indexed> STOCK = List.of(
            item("Resistor", "SMD", "RES 220E 0603 1%"),
            item("Resistor", "SMD", "RES 4K7 0603 1%"),
            item("Resistor", "THT", "RES 4K7"),
            item("Resistor", "SMD", "RES 330E 0603 1%"),
            item("Capacitor", "SMD", "CAP 0.1UF 0805"),
            item("Transistor", "SMD", "BC847- NPN BJT SOT23"))
            .stream().map(BomMatcher.Indexed::new).collect(Collectors.toList());

    private static InvoiceLineMatcher.Decision decide(String name) {
        return InvoiceLineMatcher.decide(name, null, null, STOCK);
    }

    @Test
    @DisplayName("same value and package -> SURE, adds to the existing component")
    void sameResistorIsSure() {
        InvoiceLineMatcher.Decision d = decide("[R204761] RMC06034K7FN-TyoHM-100mW ±1% 4.7kΩ 0603 Chip Resistor");
        assertThat(d.confidence()).isEqualTo(InvoiceLineMatcher.SURE);
        assertThat(d.target().c.getComponentName()).isEqualTo("RES 4K7 0603 1%");
    }

    @Test
    @DisplayName("same part number -> SURE")
    void samePartNumberIsSure() {
        InvoiceLineMatcher.Decision d = decide("[598591] BC847 NPN Transistor");
        assertThat(d.confidence()).isEqualTo(InvoiceLineMatcher.SURE);
        assertThat(d.target().c.getComponentName()).startsWith("BC847");
    }

    @Test
    @DisplayName("SMD part is never matched to a through-hole stock item")
    void smdNeverMatchesThroughHole() {
        // 4.7k in 0805: stock has 4.7k in 0603 (wrong size) and through-hole (wrong mounting).
        assertThat(decide("[R227436] RC0805FR-134K7L-YAGEO-125mW Thick Film Resistors ±1% 4.7kΩ 0805 Chip Resistor"))
                .isNull();
    }

    @Test
    @DisplayName("different tolerance -> only POSSIBLE, never pre-selected")
    void toleranceDifferenceIsOnlyPossible() {
        InvoiceLineMatcher.Decision d = decide("RC0603JR-07330RL, Yageo, SMD Chip Resistor, 330 ohm, ± 5%, 125 mW, 0603");
        assertThat(d.confidence()).isEqualTo(InvoiceLineMatcher.POSSIBLE);
        assertThat(d.note()).contains("5%").contains("1%");
    }

    @Test
    @DisplayName("capacitor whose stock item has no voltage recorded -> only POSSIBLE")
    void capacitorWithoutRecordedVoltageIsOnlyPossible() {
        InvoiceLineMatcher.Decision d = decide("CC0805KKX7R0BB104-YAGEO-100V 100nF X7R ±10% 0805 Multilayer Ceramic Capacitors");
        assertThat(d.confidence()).isEqualTo(InvoiceLineMatcher.POSSIBLE);
        assertThat(d.note()).contains("100 V");
    }

    @Test
    @DisplayName("nothing comparable in stock -> no match (a new component)")
    void unknownPartHasNoMatch() {
        assertThat(decide("[616166] 5V Active Electromagnetic Buzzer")).isNull();
    }
}
