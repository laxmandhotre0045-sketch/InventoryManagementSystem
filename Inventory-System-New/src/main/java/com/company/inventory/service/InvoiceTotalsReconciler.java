package com.company.inventory.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Component;

import com.company.inventory.dto.response.ExtractedInvoice;
import com.company.inventory.dto.response.ExtractedInvoiceLineItem;

import lombok.extern.slf4j.Slf4j;

/**
 * Repairs arithmetic in an extracted invoice, then reports what still doesn't add up.
 *
 * <p><b>Why this exists.</b> A vision model transcribing a printed invoice occasionally
 * misplaces a decimal point — reading a rate of {@code 30.51} as {@code 305.1}. The
 * mistake is invisible on the line itself but silently multiplies the purchase value by
 * ten. It is, however, arithmetically detectable: an invoice states the quantity, the
 * rate <em>and</em> the line amount, so any two of them verify the third. A misread rate
 * no longer satisfies {@code qty x rate - discount (+ tax) = line amount}, while the
 * correct rate does, and the two differ by an exact power of ten.</p>
 *
 * <p>So each line is checked against its own printed amount and, when it disagrees, the
 * rate is re-scaled by the power of ten that makes it agree. Only a power of ten is ever
 * applied — this fixes decimal-point placement and nothing else. It cannot invent a
 * digit the model misread, and it never silently rewrites the invoice's printed
 * grand total: that stays as the ground truth everything is measured against.</p>
 *
 * <p>Every change and every remaining discrepancy is returned as a human-readable
 * warning so the operator reviewing the extraction sees exactly what happened rather
 * than trusting a number that quietly changed.</p>
 */
@Slf4j
@Component
public class InvoiceTotalsReconciler {

    /** Decimal-place corrections to attempt, in order of increasing implausibility. */
    private static final int[] POWERS_OF_TEN = { -1, 1, -2, 2, -3, 3 };

    /** Money is compared to the paisa; below this two amounts are "the same". */
    private static final BigDecimal ABSOLUTE_TOLERANCE = new BigDecimal("0.05");

    /** Relative slack, to absorb the supplier's own rounding on long decimal rates. */
    private static final BigDecimal RELATIVE_TOLERANCE = new BigDecimal("0.01"); // 1%

    private static final BigDecimal GRAND_TOTAL_RELATIVE_TOLERANCE = new BigDecimal("0.005"); // 0.5%

    /**
     * Reconciles the invoice in place.
     *
     * @return warnings describing each correction applied and each discrepancy left.
     *         Empty means every line and every total agreed.
     */
    public List<String> reconcile(ExtractedInvoice inv) {
        List<String> warnings = new ArrayList<>();
        if (inv == null || inv.getItems() == null || inv.getItems().isEmpty()) {
            return warnings;
        }

        for (ExtractedInvoiceLineItem line : inv.getItems()) {
            repairLine(line, warnings);
        }

        checkInvoiceTotals(inv, warnings);
        return warnings;
    }

    // ------------------------------------------------------------------
    // Line level: the printed line amount is the anchor for the rate.
    // ------------------------------------------------------------------

    private void repairLine(ExtractedInvoiceLineItem line, List<String> warnings) {
        BigDecimal qty = line.getQuantity();
        BigDecimal price = line.getUnitPrice();
        BigDecimal printedAmount = line.getLineTotal();

        // Without all three there is nothing to cross-check against.
        if (isBlank(qty) || isBlank(price) || isBlank(printedAmount) || qty.signum() == 0) {
            return;
        }

        BigDecimal tolerance = toleranceFor(printedAmount, RELATIVE_TOLERANCE);
        BigDecimal errorAsRead = lineError(line, price, printedAmount);
        if (errorAsRead.compareTo(tolerance) <= 0) {
            return; // The line already adds up.
        }

        // Try shifting the decimal point. The first power of ten that reconciles the
        // line wins; POWERS_OF_TEN is ordered so a single-place shift is preferred.
        for (int power : POWERS_OF_TEN) {
            BigDecimal candidate = shift(price, power);
            if (lineError(line, candidate, printedAmount).compareTo(tolerance) <= 0) {
                line.setUnitPrice(candidate);
                warnings.add(String.format(
                        "%s: unit price corrected from %s to %s — %s x %s did not match the printed line amount %s.",
                        describe(line), plain(price), plain(candidate),
                        plain(qty), plain(candidate), plain(printedAmount)));
                log.info("Reconciled decimal placement on '{}': {} -> {}",
                        describe(line), plain(price), plain(candidate));
                return;
            }
        }

        // Nothing reconciles it: report rather than guess.
        warnings.add(String.format(
                "%s: %s x %s does not equal the printed line amount %s. Please check this line against the invoice.",
                describe(line), plain(qty), plain(price), plain(printedAmount)));
    }

    /**
     * How far {@code qty x price} sits from the printed amount, allowing the amount to
     * be quoted either before or after tax (invoices do both).
     */
    private BigDecimal lineError(ExtractedInvoiceLineItem line, BigDecimal price, BigDecimal printedAmount) {
        BigDecimal net = line.getQuantity().multiply(price).subtract(orZero(line.getDiscount()));
        BigDecimal gross = net.add(orZero(line.getTaxAmount()));
        return net.subtract(printedAmount).abs().min(gross.subtract(printedAmount).abs());
    }

    // ------------------------------------------------------------------
    // Invoice level: do the repaired lines add up to the printed totals?
    // ------------------------------------------------------------------

    private void checkInvoiceTotals(ExtractedInvoice inv, List<String> warnings) {
        BigDecimal computedNet = BigDecimal.ZERO;
        BigDecimal computedTax = BigDecimal.ZERO;
        for (ExtractedInvoiceLineItem line : inv.getItems()) {
            if (isBlank(line.getQuantity()) || isBlank(line.getUnitPrice())) {
                continue;
            }
            computedNet = computedNet.add(
                    line.getQuantity().multiply(line.getUnitPrice()).subtract(orZero(line.getDiscount())));
            computedTax = computedTax.add(orZero(line.getTaxAmount()));
        }
        computedNet = money(computedNet);
        computedTax = money(computedTax);

        // Fill in a sub-total the model didn't report; only flag a printed one that disagrees.
        if (isBlank(inv.getSubTotal())) {
            inv.setSubTotal(computedNet);
        } else if (differs(inv.getSubTotal(), computedNet, RELATIVE_TOLERANCE)) {
            warnings.add(String.format(
                    "Sub-total on the invoice is %s but the line items add up to %s.",
                    plain(inv.getSubTotal()), plain(computedNet)));
        }

        BigDecimal printedGrandTotal = firstPresent(inv.getGrandTotal(), inv.getFinalInvoiceAmount());
        if (isBlank(printedGrandTotal)) {
            // No printed total to honour — derive one so the UI still shows a figure.
            BigDecimal derived = money(computedNet
                    .add(taxFor(inv, computedTax))
                    .add(extraCharges(inv))
                    .subtract(invoiceLevelDiscount(inv)));
            if (isBlank(inv.getGrandTotal())) {
                inv.setGrandTotal(derived);
            }
            if (isBlank(inv.getFinalInvoiceAmount())) {
                inv.setFinalInvoiceAmount(derived);
            }
            return;
        }

        BigDecimal expected = money(computedNet
                .add(taxFor(inv, computedTax))
                .add(extraCharges(inv))
                .subtract(invoiceLevelDiscount(inv)));

        if (!differs(expected, printedGrandTotal, GRAND_TOTAL_RELATIVE_TOLERANCE)) {
            return; // Everything reconciles.
        }

        // One last chance: a single line whose decimal point is still wrong will leave a
        // gap that an exact power-of-ten shift on that line closes. Apply it only when
        // exactly one line can close the gap, so the correction is unambiguous.
        if (closeGapWithSingleLine(inv, printedGrandTotal, warnings)) {
            return;
        }

        warnings.add(String.format(
                "Invoice grand total is %s but the extracted lines add up to %s (difference %s). "
                + "Please check the highlighted lines before confirming.",
                plain(printedGrandTotal), plain(expected), plain(expected.subtract(printedGrandTotal).abs())));
    }

    /**
     * Tries a power-of-ten correction on each line in turn, looking for the one that
     * makes the whole invoice reconcile. Applied only if the solution is unique.
     */
    private boolean closeGapWithSingleLine(ExtractedInvoice inv, BigDecimal printedGrandTotal,
                                           List<String> warnings) {
        ExtractedInvoiceLineItem fixLine = null;
        BigDecimal fixPrice = null;
        int solutions = 0;

        for (ExtractedInvoiceLineItem line : inv.getItems()) {
            if (isBlank(line.getQuantity()) || isBlank(line.getUnitPrice())) {
                continue;
            }
            BigDecimal original = line.getUnitPrice();
            for (int power : POWERS_OF_TEN) {
                BigDecimal candidate = shift(original, power);
                line.setUnitPrice(candidate);
                boolean reconciles = !differs(recomputeGrandTotal(inv), printedGrandTotal,
                        GRAND_TOTAL_RELATIVE_TOLERANCE);
                line.setUnitPrice(original);
                if (reconciles) {
                    solutions++;
                    if (fixLine == null) {
                        fixLine = line;
                        fixPrice = candidate;
                    }
                    break; // one correction per line is enough to count it
                }
            }
        }

        if (solutions != 1) {
            return false;
        }

        BigDecimal before = fixLine.getUnitPrice();
        fixLine.setUnitPrice(fixPrice);
        warnings.add(String.format(
                "%s: unit price corrected from %s to %s so the invoice total matches %s.",
                describe(fixLine), plain(before), plain(fixPrice), plain(printedGrandTotal)));
        log.info("Reconciled '{}' against the invoice grand total: {} -> {}",
                describe(fixLine), plain(before), plain(fixPrice));
        return true;
    }

    private BigDecimal recomputeGrandTotal(ExtractedInvoice inv) {
        BigDecimal net = BigDecimal.ZERO;
        BigDecimal tax = BigDecimal.ZERO;
        for (ExtractedInvoiceLineItem line : inv.getItems()) {
            if (isBlank(line.getQuantity()) || isBlank(line.getUnitPrice())) {
                continue;
            }
            net = net.add(line.getQuantity().multiply(line.getUnitPrice()).subtract(orZero(line.getDiscount())));
            tax = tax.add(orZero(line.getTaxAmount()));
        }
        return money(net.add(taxFor(inv, tax))
                .add(extraCharges(inv))
                .subtract(invoiceLevelDiscount(inv)));
    }

    /**
     * Shipping and other charges to add on top of the lines — except a charge the invoice
     * also lists as one of its lines ("Shipping Charge - Porter  1 x 168.64"). Counting it
     * both ways overstated the expected total by exactly that charge and raised a false
     * "lines do not add up" warning on invoices that balance.
     */
    private BigDecimal extraCharges(ExtractedInvoice inv) {
        BigDecimal total = BigDecimal.ZERO;
        for (BigDecimal charge : new BigDecimal[] { inv.getShippingCharges(), inv.getOtherCharges() }) {
            if (charge != null && charge.signum() != 0 && !listedAsLine(inv, charge)) {
                total = total.add(charge);
            }
        }
        return total;
    }

    private boolean listedAsLine(ExtractedInvoice inv, BigDecimal charge) {
        for (ExtractedInvoiceLineItem line : inv.getItems()) {
            if (isBlank(line.getQuantity()) || isBlank(line.getUnitPrice())) {
                continue;
            }
            BigDecimal net = line.getQuantity().multiply(line.getUnitPrice()).subtract(orZero(line.getDiscount()));
            if (net.subtract(charge).abs().compareTo(ABSOLUTE_TOLERANCE) <= 0) {
                return true;
            }
        }
        return false;
    }

    /** Prefer the invoice's own tax figure; fall back to the sum of the lines'. */
    private BigDecimal taxFor(ExtractedInvoice inv, BigDecimal lineTaxTotal) {
        return isBlank(inv.getTaxAmount()) ? lineTaxTotal : inv.getTaxAmount();
    }

    /** An invoice-level discount only counts if the lines didn't already carry it. */
    private BigDecimal invoiceLevelDiscount(ExtractedInvoice inv) {
        if (isBlank(inv.getDiscountTotal())) {
            return BigDecimal.ZERO;
        }
        boolean linesCarryDiscount = inv.getItems().stream()
                .anyMatch(l -> !isBlank(l.getDiscount()) && l.getDiscount().signum() != 0);
        return linesCarryDiscount ? BigDecimal.ZERO : inv.getDiscountTotal();
    }

    // ------------------------------------------------------------------
    // Small helpers
    // ------------------------------------------------------------------

    private static BigDecimal shift(BigDecimal value, int power) {
        return power >= 0 ? value.movePointRight(power) : value.movePointLeft(-power);
    }

    private boolean differs(BigDecimal a, BigDecimal b, BigDecimal relativeTolerance) {
        return a.subtract(b).abs().compareTo(toleranceFor(b, relativeTolerance)) > 0;
    }

    private BigDecimal toleranceFor(BigDecimal amount, BigDecimal relativeTolerance) {
        return ABSOLUTE_TOLERANCE.max(amount.abs().multiply(relativeTolerance));
    }

    private static BigDecimal money(BigDecimal v) {
        return v.setScale(2, RoundingMode.HALF_UP);
    }

    private static boolean isBlank(BigDecimal v) {
        return v == null;
    }

    private static BigDecimal orZero(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static BigDecimal firstPresent(BigDecimal a, BigDecimal b) {
        return a != null ? a : b;
    }

    /** Trims trailing zeros so a corrected price reads as "30.51", not "30.510000". */
    private static String plain(BigDecimal v) {
        if (v == null) {
            return "—";
        }
        BigDecimal stripped = v.stripTrailingZeros();
        return (stripped.scale() < 0 ? stripped.setScale(0, RoundingMode.HALF_UP) : stripped).toPlainString();
    }

    private static String describe(ExtractedInvoiceLineItem line) {
        String d = line.getDescription();
        if (d == null || d.isBlank()) {
            return "Line item";
        }
        return d.length() > 60 ? d.substring(0, 57) + "..." : d;
    }
}
