package com.company.inventory.service;

import java.math.BigDecimal;
import java.math.MathContext;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads electronics facts out of free text such as part names, invoice lines and BOM
 * cells: electrical values ("4k7", "0.1UF", "Cap 1 nF", "100E", "16 Mhz"), package
 * size codes, SMD/THT mounting and primary part numbers. Pure functions, no state —
 * shared by the BOM stock check and the auto-classifier.
 */
public final class ElectronicsText {

    private ElectronicsText() {
    }

    /** A value found in text, with the token it came from (used to tell its unit). */
    public record ValueMatch(double value, String token) {
    }

    /**
     * RKM / "letter as decimal point" codes: 4k7, 1M5, 2R2, 4E7, 4n7, 47k5. Upper-case P/N/U
     * are deliberately NOT accepted, and at most two digits may follow the letter — "1N4148",
     * "1n5819" and "2N7000" are diode/transistor part numbers, not 1.4148 nF.
     */
    private static final Pattern RKM = Pattern.compile("^(\\d+)([pnumkKMGRrE])(\\d{1,2})([fFhH]?)$");
    /**
     * Number + optional multiplier + optional unit. Multipliers accept the upper-case
     * forms inventories use ("0.1UF", "22PF", "100N"); units cover farad, henry, ohm
     * written as R or E ("100R", "100E"), and hertz ("16MHz", "32.768 Khz").
     */
    private static final Pattern SI = Pattern.compile(
            "^(\\d*\\.?\\d+)(meg|MEG|Meg|[pPnNuUmkKMG])?(hz|Hz|HZ|hZ|f|F|h|H|r|R|E)?$");
    private static final Pattern OHM = Pattern.compile("(?i)ohm|\\u03A9|\\u2126");
    private static final Pattern NUMERIC = Pattern.compile("^\\d*\\.?\\d+$");
    /** A value glued to a kind prefix: "RES10k", "CAP100nF", "R4k7" — not "LM358N" (a part number). */
    private static final Pattern LEADING_LETTERS = Pattern.compile("(?i)^(?:res|r|cap|c|ind|l|xtal|y)(\\d.*)$");
    private static final Pattern SIZE = Pattern.compile(
            "(?<!\\d)(01005|0201|0402|0603|0805|1206|1210|1812|2010|2512)(?!\\d)");
    /** "25V", "63 v", "5.1v" and the "3V3" style (= 3.3 V). */
    private static final Pattern VOLTAGE = Pattern.compile(
            "(?i)(?<![\\w.])(\\d+(?:\\.\\d+)?)\\s*v(\\d{1,2})?(?![a-z0-9])");
    /** "100V", "200MA", "3W", "20Pin", "8bit", "4.5mm" — a number with a unit, not a part number. */
    private static final Pattern NUMBER_WITH_UNIT = Pattern.compile("^\\d+(\\.\\d+)?[A-Za-z]{1,3}$");

    // ---- mounting -------------------------------------------------------------------

    private static final Pattern EXPLICIT_SMD = Pattern.compile("(?i)\\b(smd|smt|surface[ -]?mount(ed)?)\\b");
    private static final Pattern EXPLICIT_THT = Pattern.compile(
            "(?i)\\b(tht|pth|through[ -]?hole|plug-?in|axial|radial)\\b");
    private static final Pattern SMD_PACKAGE = Pattern.compile(
            "(?i)((?<!\\d)(01005|0201|0402|0603|0805|1206|1210|1812|2010|2512)(?!\\d)"
                    + "|\\bsot-?\\d+|\\bsod-?\\d+|\\bsc-?70|\\bsoic|\\bsop-?\\d*\\b|\\bssop|\\btssop|\\bmsop"
                    + "|\\bqfn|\\bdfn|\\bqfp|\\blqfp|\\btqfp|\\bbga\\b|\\bdo-?214|\\bsm[abc]\\b|\\bdpak|\\bd2pak"
                    + "|\\bto-?252|\\bto-?263|\\btsot|\\bmelf\\b|\\bpowerpak)");
    private static final Pattern THT_PACKAGE = Pattern.compile(
            "(?i)(\\bdip\\d*\\b|\\bpdip|\\bto[- ]?(92|220|126|247|226|3)\\b|\\bdo-?(41|35|15|201)\\b"
                    + "|\\bhc-?49|\\bsip\\d*\\b|2\\.54\\s*mm|\\bpin header)");

    /** "SMD", "THT" or null when the text does not say. */
    public static String mountingOf(String text) {
        if (blank(text)) {
            return null;
        }
        if (EXPLICIT_SMD.matcher(text).find()) {
            return "SMD";
        }
        if (EXPLICIT_THT.matcher(text).find()) {
            return "THT";
        }
        if (SMD_PACKAGE.matcher(text).find()) {
            return "SMD";
        }
        if (THT_PACKAGE.matcher(text).find()) {
            return "THT";
        }
        return null;
    }

    // ---- values ---------------------------------------------------------------------

    /**
     * Parses "10k", "4k7", "4.7kΩ", "100nF", "0.1uF", "1M", "2R2", "10 kohm".
     * When {@code strict}, the text must carry a multiplier or a unit — a bare number
     * ("10", "0805") is not taken as a value.
     */
    public static Double siValue(String text, boolean strict) {
        if (blank(text)) {
            return null;
        }
        boolean ohm = OHM.matcher(text).find();
        String t = text.trim()
                .replace('µ', 'u').replace('μ', 'u')
                .replace("Ω", "").replace("Ω", "")
                .replaceAll("(?i)ohms?", "")
                .replace(" ", "");
        Matcher rkm = RKM.matcher(t);
        if (rkm.matches()) {
            String mult = rkm.group(2);
            if (mult.equalsIgnoreCase("r") || mult.equals("E")) {
                ohm = true; // 2R2 / 4E7 = ohms
                t = rkm.group(1) + "." + rkm.group(3) + rkm.group(4);
            } else {
                t = rkm.group(1) + "." + rkm.group(3) + mult + rkm.group(4);
            }
        }
        Matcher m = SI.matcher(t);
        if (!m.matches()) {
            return null;
        }
        String prefix = m.group(2);
        String unit = m.group(3);
        if (strict && prefix == null && unit == null && !ohm) {
            return null;
        }
        double v = Double.parseDouble(m.group(1));
        // "12 mhz" typed in lower case means megahertz — nobody lists millihertz crystals.
        if ("m".equals(prefix) && unit != null && unit.equalsIgnoreCase("hz")) {
            prefix = "M";
        }
        if (prefix != null) {
            switch (prefix) {
                case "p", "P" -> v *= 1e-12;
                case "n", "N" -> v *= 1e-9;
                case "u", "U" -> v *= 1e-6;
                case "m" -> v *= 1e-3;
                case "k", "K" -> v *= 1e3;
                case "M", "meg", "MEG", "Meg" -> v *= 1e6;
                case "G" -> v *= 1e9;
                default -> { }
            }
        }
        return v;
    }

    /**
     * First value found in free text, with the token it came from: "CAP 0.1UF 0805",
     * "Cap 1 nF" (space before unit), "RES 100 ohm", "RES 15 k ohm", "16 Mhz",
     * "ferrite bead 600E 0603", "RES10k" (value glued to a prefix).
     */
    public static ValueMatch findValue(String text) {
        if (blank(text)) {
            return null;
        }
        String[] toks = text.trim().split("[\\s,/()]+");
        for (int i = 0; i < toks.length; i++) {
            String tok = toks[i];
            if (tok.isEmpty()) {
                continue;
            }
            Double v = siValue(tok, true);
            if (v != null) {
                return new ValueMatch(v, tok);
            }
            // A bare number may be a value whose unit was written as the next word or two
            // ("Cap 1 nF", "RES 15 k ohm"). Only join it to words that are themselves a unit
            // or multiplier — never to a word starting with a digit, and never when the number
            // is a package size. Otherwise "0805 22K Ohm" reads as "080522K" = 80.522 MΩ.
            if (NUMERIC.matcher(tok).matches() && !SIZE.matcher(tok).matches()) {
                if (i + 1 < toks.length && !startsWithDigit(toks[i + 1])) {
                    String two = tok + toks[i + 1];
                    v = siValue(two, true);
                    if (v != null) {
                        return new ValueMatch(v, two);
                    }
                }
                if (i + 2 < toks.length && !startsWithDigit(toks[i + 1]) && !startsWithDigit(toks[i + 2])) {
                    String three = tok + toks[i + 1] + toks[i + 2];
                    v = siValue(three, true);
                    if (v != null) {
                        return new ValueMatch(v, three);
                    }
                }
            }
            Matcher lead = LEADING_LETTERS.matcher(tok);
            if (lead.matches()) {
                v = siValue(lead.group(1), true);
                if (v != null) {
                    return new ValueMatch(v, lead.group(1));
                }
            }
        }
        return null;
    }

    private static boolean startsWithDigit(String s) {
        return s != null && !s.isEmpty() && Character.isDigit(s.charAt(0));
    }

    public static Double firstStrictSi(String text) {
        ValueMatch m = findValue(text);
        return m == null ? null : m.value();
    }

    /** First plain number in a name that is not a package size: "RES 220" -> 220. */
    public static Double firstBareNumber(String text) {
        if (blank(text)) {
            return null;
        }
        for (String tok : text.trim().split("[\\s,/()]+")) {
            if (NUMERIC.matcher(tok).matches() && !SIZE.matcher(tok).matches()) {
                return Double.parseDouble(tok);
            }
        }
        return null;
    }

    /** Unit written in a value token: "Hz", "F", "H", "Ω" — or null for "10k", "4k7". */
    public static String unitOf(String token) {
        if (blank(token)) {
            return null;
        }
        String t = token.replace(" ", "");
        if (t.matches("(?i).*\\d[pnumkg]?hz$")) {
            return "Hz";
        }
        if (OHM.matcher(t).find() || t.matches("^\\d*\\.?\\d+(meg|[kKmMG])?[rRE]$") || t.matches("^\\d+[rRE]\\d+$")) {
            return "Ω";
        }
        if (t.matches("(?i).*\\d[pnumµμ]?f$")) {
            return "F";
        }
        if (t.matches("(?i).*\\d[pnumµμ]?h$")) {
            return "H";
        }
        return null;
    }

    /** Multiplier letter alone ("10k" -> 'k', "100n" -> 'n'), or 0 when there is none. */
    public static char prefixOf(String token) {
        if (blank(token)) {
            return 0;
        }
        Matcher m = Pattern.compile("^\\d*\\.?\\d+(meg|MEG|Meg|[pPnNuUmkKMG])").matcher(token.replace(" ", ""));
        if (!m.find()) {
            return 0;
        }
        String p = m.group(1);
        return p.length() > 1 ? 'M' : p.charAt(0);
    }

    /** Formats a value with the right SI prefix: 4700 Ω -> "4.7kΩ", 1e-7 F -> "100nF". */
    public static String formatValue(double value, String unit) {
        if (unit == null) {
            unit = "";
        }
        double abs = Math.abs(value);
        double scale;
        String prefix;
        switch (unit) {
            case "F" -> {
                if (abs >= 1) { scale = 1; prefix = ""; }
                else if (abs >= 1e-6) { scale = 1e-6; prefix = "µ"; }
                else if (abs >= 1e-9) { scale = 1e-9; prefix = "n"; }
                else { scale = 1e-12; prefix = "p"; }
            }
            case "H" -> {
                if (abs >= 1) { scale = 1; prefix = ""; }
                else if (abs >= 1e-3) { scale = 1e-3; prefix = "m"; }
                else if (abs >= 1e-6) { scale = 1e-6; prefix = "µ"; }
                else { scale = 1e-9; prefix = "n"; }
            }
            default -> { // ohm, hertz, unitless
                if (abs >= 1e9) { scale = 1e9; prefix = "G"; }
                else if (abs >= 1e6) { scale = 1e6; prefix = "M"; }
                else if (abs >= 1e3) { scale = 1e3; prefix = "k"; }
                else { scale = 1; prefix = ""; }
            }
        }
        BigDecimal mantissa = new BigDecimal(value / scale, new MathContext(6)).stripTrailingZeros();
        return mantissa.toPlainString() + prefix + unit;
    }

    /** Voltage rating written in text ("5.1v", "25V", "63 v") formatted as "25V", or null. */
    public static String voltageOf(String text) {
        if (blank(text)) {
            return null;
        }
        Double v = voltageValue(text);
        return v == null ? null : new BigDecimal(String.valueOf(v)).stripTrailingZeros().toPlainString() + "V";
    }

    /** Voltage written in text as a number ("25V" -> 25.0, "5.1v" -> 5.1), or null. */
    public static Double voltageValue(String text) {
        if (blank(text)) {
            return null;
        }
        Matcher m = VOLTAGE.matcher(text);
        if (!m.find()) {
            return null;
        }
        if (m.group(2) != null && !m.group(1).contains(".")) {
            return Double.valueOf(m.group(1) + "." + m.group(2)); // 3V3 = 3.3 V
        }
        return Double.valueOf(m.group(1));
    }

    private static final Pattern CURRENT = Pattern.compile(
            "(?i)(?<![\\w.])(\\d+(?:\\.\\d+)?)\\s*(ma|a|amp|amps|ampere)(?![a-z])");

    /** Current rating in amps ("7A", "7 amp", "500mA" -> 0.5), or null. */
    public static Double currentOf(String text) {
        if (blank(text)) {
            return null;
        }
        Matcher m = CURRENT.matcher(text);
        if (!m.find()) {
            return null;
        }
        double v = Double.parseDouble(m.group(1));
        return m.group(2).equalsIgnoreCase("ma") ? v / 1000 : v;
    }

    public static boolean sameValue(double a, double b) {
        double max = Math.max(Math.abs(a), Math.abs(b));
        return max == 0 || Math.abs(a - b) <= max * 1e-6;
    }

    public static String sizeCode(String text) {
        if (blank(text)) {
            return null;
        }
        Matcher m = SIZE.matcher(text);
        return m.find() ? m.group(1) : null;
    }

    public static boolean isNumeric(String s) {
        return s != null && NUMERIC.matcher(s.trim()).matches();
    }

    // ---- part numbers ---------------------------------------------------------------

    /**
     * "LM358", "ESP32-WROOM-32E", "1N4148", "DHT11" — one word mixing letters and digits
     * that is not an electrical value ("100nF", "4k7" are values, not part numbers).
     */
    public static boolean looksLikePartNumber(String s) {
        if (blank(s)) {
            return false;
        }
        String t = s.trim();
        return t.length() >= 4 && !t.matches(".*\\s.*")
                && t.matches(".*[A-Za-z].*") && t.matches(".*\\d.*")
                && siValue(t, true) == null;
    }

    /**
     * The main part number in a name: "LM358- dual op amps" -> "LM358",
     * "BC 847 Diode" -> "BC847", "[R193160] BAT54C-Slkor-30V ..." -> "BAT54C-Slkor-30V".
     * Supplier codes in brackets, values, sizes and "100V"-style specs are skipped.
     */
    public static String primaryPartNumber(String text) {
        if (blank(text)) {
            return null;
        }
        String[] toks = text.replaceAll("\\[[^\\]]*\\]", " ").trim().split("[\\s,()]+");
        for (int i = 0; i < toks.length; i++) {
            String tok = toks[i].replaceAll("^[^A-Za-z0-9]+|[^A-Za-z0-9]+$", "");
            if (tok.isEmpty()) {
                continue;
            }
            // "LM 358", "BC 847": a short letters-only prefix followed by a digits-only number.
            if (tok.matches("[A-Za-z]{2,4}") && i + 1 < toks.length && toks[i + 1].matches("\\d{2,6}")) {
                return tok.toUpperCase(Locale.ROOT) + toks[i + 1];
            }
            if (looksLikePartNumber(tok) && SIZE.matcher(tok).replaceAll("").length() > 0
                    && !NUMBER_WITH_UNIT.matcher(tok).matches() && !SIZE.matcher(tok).matches()) {
                return tok.length() > 40 ? tok.substring(0, 40) : tok;
            }
        }
        return null;
    }

    /** Letters that start a "LM 358"-style pair but are not part-number prefixes. */
    private static final java.util.Set<String> NOT_PART_PREFIX = java.util.Set.of(
            "to", "sot", "sod", "do", "sop", "soic", "dip", "qfn", "sma", "smb", "smc", "lqfp", "tqfp", "sc",
            "res", "cap", "ind", "pin", "pins", "rev", "ver", "qty", "pcs", "nos", "dc", "ac", "vdc", "vac",
            "pf", "nf", "uf", "mm", "and", "for", "with");
    /** Package names that look like part numbers: "SOT-23", "DIP-8", "TO-263-5L", "16-TSSOP", "DO-214AC". */
    private static final Pattern PACKAGE_TOKEN = Pattern.compile(
            "(?i)^(\\d+-?)?(dip|pdip|sot|sod|to|do|sop|soic|so|qfn|dfn|tssop|tsssop|ssop|msop|lqfp|tqfp|qfp|sc|"
                    + "sma|smb|smc|tsot|sip|hc|dpak|d2pak)(-?\\d+[a-z]{0,2})*(-\\d+[a-z]?)?$");

    /**
     * Every part-number-like token in free text, in order: "Opamp TL072" -> [TL072],
     * "LM 358 DIP-8" -> [LM358], "D IN 5819W" -> [IN5819W], "LM2596S-3.3/NOPB" -> [LM2596S-3.3, NOPB].
     * Supplier codes in brackets, values, package names and "100V"-style specs are skipped.
     */
    public static java.util.List<String> partNumbers(String text) {
        java.util.List<String> out = new java.util.ArrayList<>();
        if (blank(text)) {
            return out;
        }
        String[] toks = text.replaceAll("\\[[^\\]]*\\]", " ").trim().split("[\\s,()/;]+");
        for (int i = 0; i < toks.length; i++) {
            String tok = toks[i].replaceAll("^[^A-Za-z0-9]+|[^A-Za-z0-9]+$", "");
            if (tok.isEmpty() || tok.contains("@")) {
                continue;
            }
            // "LM 358", "BC 847", "IN 5819W": short letters followed by a number.
            if (tok.matches("[A-Za-z]{2,4}") && i + 1 < toks.length
                    && !NOT_PART_PREFIX.contains(tok.toLowerCase(Locale.ROOT))) {
                String next = toks[i + 1].replaceAll("[^A-Za-z0-9]+$", "");
                if (next.matches("\\d{2,6}[A-Za-z]{0,3}")) {
                    addOnce(out, tok + next);
                    i++;
                    continue;
                }
            }
            if (looksLikePartNumber(tok) && !NUMBER_WITH_UNIT.matcher(tok).matches()
                    && !SIZE.matcher(tok).matches() && !PACKAGE_TOKEN.matcher(tok).matches()) {
                addOnce(out, tok.length() > 40 ? tok.substring(0, 40) : tok);
            }
        }
        return out;
    }

    private static void addOnce(java.util.List<String> list, String s) {
        if (!list.contains(s)) {
            list.add(s);
        }
    }

    static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
