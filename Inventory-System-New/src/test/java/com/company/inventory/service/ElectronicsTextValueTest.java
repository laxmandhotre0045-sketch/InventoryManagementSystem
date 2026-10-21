package com.company.inventory.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.withinPercentage;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Values read out of invoice and inventory names — including the ones that used to misread. */
class ElectronicsTextValueTest {

    private static double value(String text) {
        return ElectronicsText.findValue(text).value();
    }

    @Test
    @DisplayName("a package size is never glued onto the value after it")
    void packageSizeIsNotPartOfTheValue() {
        // These read as 80.522 MΩ, 80.51 MΩ, 60.31 MΩ and 805.47 kΩ before the fix.
        assertThat(value("[R136928] AC0805FR-0722KL-YAGEO-Res Thick Film 0805 22K Ohm 1%")).isCloseTo(22_000.0, withinPercentage(0.0001));
        assertThat(value("[R137524] AC0805JR-0710KL-YAGEO-Res Thick Film 0805 10K Ohm 5%")).isCloseTo(10_000.0, withinPercentage(0.0001));
        assertThat(value("[R138649] RC0603FR-0710KL-YAGEO-Res Thick Film 0603 10K Ohm 1%")).isCloseTo(10_000.0, withinPercentage(0.0001));
        assertThat(value("[R135914] RC0805FR-07470RL-YAGEO-Res Thick Film 0805 470 Ohm 1%")).isCloseTo(470.0, withinPercentage(0.0001));
    }

    @Test
    @DisplayName("a unit written as a separate word still joins its number")
    void separateUnitWordsStillWork() {
        assertThat(value("Cap 1 nF")).isCloseTo(1e-9, withinPercentage(0.0001));
        assertThat(value("RES 15 k ohm")).isCloseTo(15_000.0, withinPercentage(0.0001));
        assertThat(value("RES 100 ohm")).isCloseTo(100.0, withinPercentage(0.0001));
        assertThat(value("Cap 150  nF")).isCloseTo(150e-9, withinPercentage(0.0001));
    }
}
