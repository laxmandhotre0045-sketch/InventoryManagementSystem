package com.company.inventory.service.impl;

import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.company.inventory.service.BomFileParser.BomRow;
import com.company.inventory.service.ElectronicsText;

/**
 * Decides whether an invoice line is a part that is already in stock — so confirming the
 * invoice adds to that component's quantity instead of creating a second copy of it.
 *
 * <p>Invoice names rarely look like inventory names: Robu prints
 * "[R204761] RMC06034K7FN-TyoHM-100mW ±1% 4.7kΩ 0603 Chip Resistor" for what the shelf
 * calls "RES 4K7 0603 1%". Matching by name therefore created a new component for almost
 * every line. This reuses the BOM matcher, which reads kind, value, package size, voltage,
 * colour and part numbers out of both texts and rules out anything that clearly differs.</p>
 *
 * <p>Two levels, because merging stock into the wrong part is worse than a duplicate:</p>
 * <ul>
 *   <li><b>SURE</b> — the same part number, or for passives the same kind, value <i>and</i>
 *       package size with nothing contradicting (voltage rating, tolerance, mounting).
 *       The review screen pre-selects "add to this component".</li>
 *   <li><b>POSSIBLE</b> — a likely candidate with something unconfirmed (no package on
 *       the stock item, no voltage recorded, a look-alike part number). Shown as a
 *       suggestion the operator accepts with one click; never pre-selected.</li>
 * </ul>
 */
final class InvoiceLineMatcher {

    private InvoiceLineMatcher() {
    }

    static final String SURE = "SURE";
    static final String POSSIBLE = "POSSIBLE";

    /** Below this score a candidate is too weak to even suggest. */
    private static final int MIN_SUGGEST_SCORE = 55;

    private static final Pattern TOLERANCE = Pattern.compile("(\\d+(?:\\.\\d+)?)\\s*%");

    record Decision(BomMatcher.Indexed target, String confidence, String note) {
    }

    /**
     * @param name        the invoice line as printed
     * @param supplierSku supplier's catalogue code, may be null
     * @param packageName package the AI read off the invoice ("0805", "SOT-23"), may be null
     */
    static Decision decide(String name, String supplierSku, String packageName, List<BomMatcher.Indexed> inventory) {
        if (name == null || name.isBlank() || inventory.isEmpty()) {
            return null;
        }
        BomRow row = new BomRow();
        row.name = name.trim();
        row.part = supplierSku;
        row.footprint = packageName;
        row.quantity = 1;
        BomMatcher.Line line = new BomMatcher.Line(row);
        BomMatcher.Result result = BomMatcher.match(line, inventory);
        // An SMD part and a through-hole part are never the same component, however alike
        // the value: skip such candidates and take the next one, if any.
        BomMatcher.Match best = null;
        List<BomMatcher.Match> candidates = new java.util.ArrayList<>();
        if (result.best() != null) {
            candidates.add(result.best());
        }
        candidates.addAll(result.alternatives());
        for (BomMatcher.Match m : candidates) {
            if (m.score() >= MIN_SUGGEST_SCORE && !mountingConflict(line, m.target())) {
                best = m;
                break;
            }
        }
        if (best == null) {
            return null;
        }
        BomMatcher.Indexed c = best.target();

        String doubt = doubt(line, c, name);
        boolean partSure = "EXACT".equals(best.type()) && "HIGH".equals(best.confidence());
        boolean passiveSure = isPassive(line.kind) && line.kind == c.kind
                && line.value != null && c.value != null && ElectronicsText.sameValue(line.value, c.value)
                && line.size != null && line.size.equals(c.size);

        if ((partSure || passiveSure) && doubt == null) {
            return new Decision(c, SURE, null);
        }
        String note = doubt != null ? doubt
                : best.note() != null ? best.note()
                : missingDetail(line, c);
        return new Decision(c, POSSIBLE, note);
    }

    /** Something that stops a candidate being certain, in words the operator can check. */
    private static String doubt(BomMatcher.Line l, BomMatcher.Indexed c, String name) {
        String stockText = BomMatcher.join(c.c.getComponentName(), c.c.getDescription());
        Double tl = tolerance(name);
        Double tc = tolerance(stockText);
        if (tl != null && tc != null && !ElectronicsText.sameValue(tl, tc)) {
            return "Tolerance differs: invoice " + fmt(tl) + "%, stock item " + fmt(tc) + "%";
        }
        if (l.kind == BomMatcher.Kind.CAP) {
            // Read from the invoice text itself: the printed rating ("…-25V 22uF") is what
            // the part is, and the matcher's own part-number reading can misplace it.
            Double volts = ElectronicsText.voltageValue(name);
            if (volts == null) {
                volts = l.voltage;
            }
            if (volts != null && c.voltage == null) {
                return "Stock item has no voltage rating recorded; invoice part is " + fmt(volts) + " V";
            }
            if (volts != null && c.voltage + 1e-9 < volts) {
                return "Stock item is rated " + fmt(c.voltage) + " V; invoice part is " + fmt(volts) + " V";
            }
        }
        return null;
    }

    private static boolean mountingConflict(BomMatcher.Line l, BomMatcher.Indexed c) {
        return l.mounting != null && c.mounting != null && !l.mounting.equals(c.mounting);
    }

    private static String missingDetail(BomMatcher.Line l, BomMatcher.Indexed c) {
        if (isPassive(l.kind) && (l.size == null || c.size == null)) {
            return "Package size not stated on " + (l.size == null ? "the invoice line" : "the stock item")
                    + " — check it is the same part";
        }
        return "Similar part — check it is the same one";
    }

    private static boolean isPassive(BomMatcher.Kind k) {
        return k == BomMatcher.Kind.RES || k == BomMatcher.Kind.CAP
                || k == BomMatcher.Kind.IND || k == BomMatcher.Kind.FERRITE;
    }

    static Double tolerance(String text) {
        if (text == null) {
            return null;
        }
        Matcher m = TOLERANCE.matcher(text);
        return m.find() ? Double.valueOf(m.group(1)) : null;
    }

    private static String fmt(double v) {
        return v == Math.rint(v) ? String.valueOf((long) v) : String.format(Locale.ROOT, "%s", v);
    }
}
