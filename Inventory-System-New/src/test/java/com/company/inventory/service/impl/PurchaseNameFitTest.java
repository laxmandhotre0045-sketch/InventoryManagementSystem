package com.company.inventory.service.impl;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** Invoice names longer than the 150-character name column used to fail the whole invoice. */
class PurchaseNameFitTest {

    @Test
    void longNameIsCutAtAWordBoundaryWithinTheLimit() {
        String robu = "[R193008] AMS1117-3.3-Slkor-800mA 70dB@(120Hz) Fixed 3.3V Positive electrode 18V SOT-223 "
                + "Voltage Regulators - Linear, Low Drop Out (LDO) Regulators ROHS";
        String fitted = PurchaseServiceImpl.fitName(robu, 150);
        assertThat(robu.length()).isGreaterThan(150);
        assertThat(fitted.length()).isLessThanOrEqualTo(150);
        assertThat(robu).startsWith(fitted);
        assertThat(fitted).doesNotEndWith(" ").doesNotEndWith("-").doesNotEndWith(",");
    }

    @Test
    void shortNameIsUnchanged() {
        assertThat(PurchaseServiceImpl.fitName("RES 4K7 0603 1%", 150)).isEqualTo("RES 4K7 0603 1%");
    }
}
