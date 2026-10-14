package com.company.inventory.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.company.inventory.dto.response.ComponentClassification;
import com.company.inventory.entity.ComponentCategory;
import com.company.inventory.entity.ComponentItem;
import com.company.inventory.entity.ComponentStatus;
import com.company.inventory.repository.ComponentCategoryRepository;
import com.company.inventory.repository.ComponentRepository;

/** Auto-filing suggestions, checked against the real categories and naming of this inventory. */
class ComponentClassifierTest {

    private ComponentCategoryRepository catRepo;
    private ComponentRepository compRepo;
    private ComponentClassifier.Session session;

    private static ComponentCategory cat(long id, String name) {
        return ComponentCategory.builder().id(id).name(name).build();
    }

    private static ComponentItem comp(String name, ComponentCategory c) {
        return ComponentItem.builder().componentName(name).category(c).quantity(1).minimumQuantity(0)
                .status(ComponentStatus.ACTIVE).build();
    }

    @BeforeEach
    void setUp() {
        ComponentCategory resistor = cat(1, "Resistor");
        ComponentCategory diode = cat(4, "Diode");
        ComponentCategory mcu = cat(9, "Microcontroller");
        List<ComponentCategory> cats = new ArrayList<>(List.of(
                resistor, cat(2, "Capacitor"), cat(3, "IC"), diode, cat(5, "Transistor"), cat(6, "Inductor"),
                cat(7, "Connector"), cat(8, "Sensor"), mcu, cat(10, "Module"), cat(11, "Other"),
                cat(13, "Programmer"), cat(14, "Switches"), cat(15, "DC-DC Converters"), cat(16, "Potentiometer"),
                cat(17, "Crystal Oscillator"), cat(18, "Fuse"), cat(19, "Display")));
        catRepo = mock(ComponentCategoryRepository.class);
        compRepo = mock(ComponentRepository.class);
        when(catRepo.findAll()).thenReturn(cats);
        // The user's own habits: ferrite beads live under Resistor, LEDs under Diode.
        when(compRepo.findAll()).thenReturn(List.of(
                comp("ferrite bead 600E 0603", resistor),
                comp("Ferrite beed", resistor),
                comp("D Red LED", diode),
                comp("D Green LED", diode),
                comp("RES 10K", resistor),
                comp("MS51FB9AE- Nuvoton, 8bit 8051", mcu)));
        session = new ComponentClassifier(catRepo, compRepo).session();
    }

    private ComponentClassification c(String name, String hint, String mounting) {
        return session.classify(name, null, hint, mounting);
    }

    @Test
    void passivesGetCategoryMountingAndNormalisedValue() {
        assertEquals("Capacitor › SMD › 100nF", c("CAP 0.1UF 0805", null, null).getPath());
        assertEquals("Capacitor › 1nF", c("CAP 1000 PF", null, null).getPath());
        assertEquals("Capacitor › SMD › 470nF 25V", c("Cap 0.47 uF, 25V, 1206", null, null).getPath());
        assertEquals("Resistor › SMD › 10kΩ", c("RES 10K 0603 1%", null, null).getPath());
        // No package in the text: the AI's mounting fills in the type.
        assertEquals("Resistor › THT › 10kΩ",
                c("10k Ohm 0.25W Metal Film Resistor", "Passive Components", "THT").getPath());
        assertEquals("Crystal Oscillator › 16MHz", c("16 Mhz", null, null).getPath());
        assertEquals("Diode › THT › 5.1V", c("Zener diode 5.1V THT", null, null).getPath());
    }

    @Test
    void followsTheUsersOwnFilingHabits() {
        ComponentClassification ferrite = c("Ferrite bead 600 ohm 0805", null, null);
        assertEquals("Resistor", ferrite.getCategory(), "ferrite beads are filed under Resistor here");
        assertEquals("Resistor › SMD › 600Ω", ferrite.getPath());
        assertTrue(ferrite.getReason().contains("filed under \"Resistor\""));

        assertEquals("Diode › THT › Blue", c("Blue LED 5mm", null, "THT").getPath());
    }

    @Test
    void activePartsUseThePartNumberAsValue() {
        assertEquals("IC › SMD › LM358", c("LM358 dual op amp SOIC-8", "Amplifiers", null).getPath());
        assertEquals("IC › THT › LM358", c("LM 358 DIP-8", "IC", null).getPath());
        assertEquals("Transistor › SMD › IPD50P04P4L11",
                c("IPD50P04P4L11 Power MOSFET, P Channel TO-252 DPAK", null, null).getPath());
        assertEquals("Sensor › Module › DHT11",
                c("DHT11 temperature humidity sensor module", null, null).getPath());
        assertEquals("Microcontroller › SMD › MS51FB3AE",
                c("MS51FB3AE Nuvoton 8051 MCU TSSOP-20", null, null).getPath());
    }

    @Test
    void sourceCategoryWinsWhenItNamesAnExistingCategory() {
        ComponentClassification x = c("Odd part X1", "Capacitors", null);
        assertEquals("Capacitor", x.getCategory());
        assertEquals(2L, x.getCategoryId());
        assertFalse(x.isCategoryIsNew());
    }

    @Test
    void unknownItemsFallBackToOtherAndNewCategoriesAreFlagged() {
        ComponentClassification unknown = c("Mystery gadget", null, null);
        assertEquals("Other", unknown.getCategory());
        assertFalse(unknown.isCategoryIsNew());
        assertNull(unknown.getType());

        ComponentClassification fresh = c("18650 cell", "Batteries", null);
        assertEquals("Batteries", fresh.getCategory());
        assertTrue(fresh.isCategoryIsNew());
        assertNull(fresh.getCategoryId());
    }

    @Test
    void onlyReadsTheDatabase() {
        verify(catRepo).findAll();
        verify(compRepo).findAll();
        verifyNoMoreInteractions(catRepo, compRepo);
    }
}
