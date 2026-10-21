package com.company.inventory.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.company.inventory.dto.response.ExtractedInvoice;
import com.company.inventory.dto.response.ExtractedInvoiceLineItem;

/**
 * The reconciler's job is to catch a misplaced decimal point before it becomes stock
 * value, using the invoice's own arithmetic as the proof. These tests pin both halves
 * of that contract: it must correct what is provably wrong, and leave alone what isn't.
 */
class InvoiceTotalsReconcilerTest {

    private final InvoiceTotalsReconciler reconciler = new InvoiceTotalsReconciler();

    private static ExtractedInvoiceLineItem line(String desc, String qty, String unitPrice, String lineTotal) {
        ExtractedInvoiceLineItem l = new ExtractedInvoiceLineItem();
        l.setDescription(desc);
        l.setQuantity(new BigDecimal(qty));
        l.setUnitPrice(new BigDecimal(unitPrice));
        if (lineTotal != null) {
            l.setLineTotal(new BigDecimal(lineTotal));
        }
        return l;
    }

    private static ExtractedInvoice invoiceOf(ExtractedInvoiceLineItem... items) {
        ExtractedInvoice inv = new ExtractedInvoice();
        inv.setIsInvoice(true);
        inv.setItems(new java.util.ArrayList<>(List.of(items)));
        return inv;
    }

    @Test
    @DisplayName("the reported bug: a rate read as 305.1 instead of 30.51 is corrected")
    void correctsRateReadTenTimesTooHigh() {
        // The invoice prints: 4 units, rate 30.51, amount 122.04.
        // The model misread the rate as 305.1; the printed amount proves it wrong.
        ExtractedInvoice inv = invoiceOf(line("ESP32 DevKit", "4", "305.1", "122.04"));

        List<String> warnings = reconciler.reconcile(inv);

        assertThat(inv.getItems().get(0).getUnitPrice()).isEqualByComparingTo("30.51");
        assertThat(warnings).singleElement().asString()
                .contains("unit price corrected from 305.1 to 30.51");
    }

    @Test
    @DisplayName("a rate read ten times too low is corrected the same way")
    void correctsRateReadTenTimesTooLow() {
        ExtractedInvoice inv = invoiceOf(line("CAP 2.2UF", "200", "0.15", "300.00"));

        reconciler.reconcile(inv);

        assertThat(inv.getItems().get(0).getUnitPrice()).isEqualByComparingTo("1.5");
    }

    @Test
    @DisplayName("a line that already adds up is never touched")
    void leavesConsistentLinesAlone() {
        ExtractedInvoice inv = invoiceOf(line("ESP32 DevKit", "50", "320.00", "16000.00"));

        List<String> warnings = reconciler.reconcile(inv);

        assertThat(inv.getItems().get(0).getUnitPrice()).isEqualByComparingTo("320.00");
        assertThat(warnings).isEmpty();
    }

    @Test
    @DisplayName("tax-inclusive line amounts still reconcile")
    void acceptsLineTotalQuotedAfterTax() {
        ExtractedInvoiceLineItem l = line("OPA192IDR", "10", "100.00", "1180.00");
        l.setTaxAmount(new BigDecimal("180.00"));
        ExtractedInvoice inv = invoiceOf(l);

        List<String> warnings = reconciler.reconcile(inv);

        assertThat(l.getUnitPrice()).isEqualByComparingTo("100.00");
        assertThat(warnings).isEmpty();
    }

    @Test
    @DisplayName("the grand total anchors a line the model gave no amount for")
    void usesGrandTotalToFixALineWithNoPrintedAmount() {
        ExtractedInvoice inv = invoiceOf(
                line("Resistor 10k", "100", "1.00", "100.00"),
                line("Sensor module", "2", "2500.00", null)); // rate misread, no amount printed
        inv.setGrandTotal(new BigDecimal("600.00")); // 100 + 2 x 250

        List<String> warnings = reconciler.reconcile(inv);

        assertThat(inv.getItems().get(1).getUnitPrice()).isEqualByComparingTo("250.00");
        assertThat(warnings).anyMatch(w -> w.contains("so the invoice total matches"));
    }

    @Test
    @DisplayName("an unexplainable mismatch is reported, never silently 'fixed'")
    void reportsMismatchItCannotJustify() {
        // 7 x 13.30 = 93.10, nowhere near 250 by any power of ten.
        ExtractedInvoice inv = invoiceOf(line("Mystery part", "7", "13.30", "250.00"));

        List<String> warnings = reconciler.reconcile(inv);

        assertThat(inv.getItems().get(0).getUnitPrice()).isEqualByComparingTo("13.30");
        assertThat(warnings).isNotEmpty();
        assertThat(warnings.get(0)).contains("does not equal the printed line amount");
    }

    @Test
    @DisplayName("a missing sub-total is filled in from the lines")
    void derivesSubTotalWhenAbsent() {
        ExtractedInvoice inv = invoiceOf(
                line("A", "2", "50.00", "100.00"),
                line("B", "1", "25.50", "25.50"));

        reconciler.reconcile(inv);

        assertThat(inv.getSubTotal()).isEqualByComparingTo("125.50");
    }

    @Test
    @DisplayName("the invoice's printed grand total is never overwritten")
    void keepsPrintedGrandTotal() {
        ExtractedInvoice inv = invoiceOf(line("A", "1", "100.00", "100.00"));
        inv.setGrandTotal(new BigDecimal("118.00"));
        inv.setTaxAmount(new BigDecimal("18.00"));

        reconciler.reconcile(inv);

        assertThat(inv.getGrandTotal()).isEqualByComparingTo("118.00");
    }

    @Test
    @DisplayName("an empty or absent item list is handled without complaint")
    void toleratesEmptyInvoice() {
        assertThat(reconciler.reconcile(invoiceOf())).isEmpty();
        assertThat(reconciler.reconcile(null)).isEmpty();
    }

    @Test
    @DisplayName("shipping listed as a line is not counted a second time (invoice SO289050)")
    void shippingListedAsALineIsNotCountedTwice() {
        // Parts 20100.03 + "Shipping Charge - Porter" 1 x 168.64 = sub-total 20268.67;
        // tax 3648.38; grand total 23917.05. The invoice also states shipping 168.64.
        ExtractedInvoice inv = invoiceOf(
                line("Parts", "1", "20100.03", "20100.03"),
                line("Shipping Charge - Porter", "1", "168.64", "168.64"));
        inv.setSubTotal(new BigDecimal("20268.67"));
        inv.setTaxAmount(new BigDecimal("3648.38"));
        inv.setShippingCharges(new BigDecimal("168.64"));
        inv.setGrandTotal(new BigDecimal("23917.05"));

        assertThat(reconciler.reconcile(inv)).isEmpty();
    }

    @Test
    @DisplayName("shipping stated only in the totals is still added")
    void shippingOnlyInTotalsIsAdded() {
        ExtractedInvoice inv = invoiceOf(line("Parts", "1", "1000.00", "1000.00"));
        inv.setShippingCharges(new BigDecimal("50.00"));
        inv.setGrandTotal(new BigDecimal("1050.00"));

        assertThat(reconciler.reconcile(inv)).isEmpty();
    }
}
