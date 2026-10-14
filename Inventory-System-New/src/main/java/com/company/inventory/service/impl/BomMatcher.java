package com.company.inventory.service.impl;

import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.company.inventory.entity.ComponentItem;
import com.company.inventory.service.BomFileParser.BomRow;
import com.company.inventory.service.ElectronicsText;

/**
 * Decides which inventory component a BOM line refers to.
 *
 * <p>Both sides are typed by hand, so the matcher expects mistakes: look-alike characters
 * ("A03401A" for AO3401A, "IN4007" for 1N4007, "TP561023" for TPS61023), ordering and package
 * suffixes (LM393DR vs LM393P, MMBT5550LT1G vs MMBT5550L), part numbers buried in text
 * ("Opamp TL072", "LM 358"), different maker prefixes (LM7805 vs KA7805), misspelt kind words
 * ("capasitor", "resister", "crystl", "ferite") and values written every possible way.</p>
 *
 * <p>Matching, strongest first:</p>
 * <ol>
 *   <li>Part numbers — exact, embedded in a longer name, equal apart from look-alike
 *       characters, equal apart from an ordering suffix, same base part, same generic number.</li>
 *   <li>Name text — equal names, or one name contained in the other.</li>
 *   <li>Electrical value for the same kind of part (10k = 10kΩ = 4k7…, 100nF = 0.1µF,
 *       16 MHz, zener voltage, fuse current, LED colour).</li>
 *   <li>Words — every word of the inventory name in the BOM line (or the reverse),
 *       tolerant of small spelling mistakes.</li>
 * </ol>
 * <p>Value, package size, LED colour, dielectric, capacitor voltage and part-kind conflicts
 * rule a candidate out for everything except a part-number match, which is specific enough
 * on its own (it is only marked down). A regulator whose voltage version differs from the BOM
 * (AMS1117-5.0 vs a 3.3 V AMS1117) is never more than a LOW "verify" suggestion.</p>
 */
final class BomMatcher {

    private BomMatcher() {
    }

    enum Kind { RES, POT, CAP, IND, FERRITE, DIODE, LED, TRANSISTOR, IC, XTAL, CONN, FUSE, SWITCH, RELAY, UNKNOWN }

    /** One scored candidate. */
    record Match(Indexed target, String type, String confidence, int score, String note) {
    }

    /** The best candidate plus the next-best other components, for "verify" lines. */
    record Result(Match best, List<Match> alternatives) {
    }

    // ================================================================== matching

    static Result match(Line line, List<Indexed> inventory) {
        List<Match> all = new ArrayList<>();
        for (Indexed c : inventory) {
            Match m = score(line, c);
            if (m != null) {
                all.add(m);
            }
        }
        if (all.isEmpty()) {
            return new Result(null, List.of());
        }
        all.sort((a, b) -> {
            if (a.score != b.score) {
                return Integer.compare(b.score, a.score);
            }
            boolean ka = compatible(line.kind, a.target.kind);
            boolean kb = compatible(line.kind, b.target.kind);
            if (ka != kb) {
                return ka ? -1 : 1;
            }
            return Integer.compare(qty(b.target), qty(a.target));
        });
        Match best = all.get(0);
        List<Match> alts = new ArrayList<>();
        if (!"HIGH".equals(best.confidence)) {
            for (Match m : all.subList(1, all.size())) {
                if (alts.size() == 2) {
                    break;
                }
                if (m.score >= 40 && m.score >= best.score - 25) {
                    alts.add(m);
                }
            }
        }
        return new Result(best, alts);
    }

    private static Match score(Line l, Indexed c) {
        Match best = null;

        // ---- 1. Part numbers: specific enough to bypass value/kind conflicts.
        for (Part p : l.parts) {
            best = better(best, partMatch(l, p, c));
        }
        String partKey = key(l.row.part);
        if (partKey.length() >= 2 && (partKey.equals(c.codeKey) || partKey.equals(c.nameKey))) {
            best = better(best, new Match(c, "EXACT", "HIGH", 100, null));
        }
        if (best != null) {
            best = adjustPartMatch(l, c, best);
        }

        // ---- 2-4. Text, value and words — only for candidates that do not conflict.
        if (!conflicts(l, c)) {
            Match t = textMatch(l, c);
            if (t != null) {
                best = better(best, withAttributeBonus(l, c, t));
            }
        }
        return best;
    }

    private static Match partMatch(Line l, Part p, Indexed c) {
        Match m = null;
        if (p.key.length() >= 2 && (p.key.equals(c.codeKey) || p.key.equals(c.nameKey) || c.partKeys.contains(p.key))) {
            m = new Match(c, "EXACT", "HIGH", 100, null);
        } else if (p.key.length() >= 5 && c.nameKey.contains(p.key)) {
            // "BAT54" inside "BAT54C-…": the stock part number carries an extra letter, which
            // can be a different variant (BAT54C is the dual common-cathode version).
            Part longer = null;
            for (Part t : c.parts) {
                if (t.key.length() > p.key.length() && t.key.startsWith(p.key)
                        && Character.isLetter(t.key.charAt(p.key.length()))) {
                    longer = t;
                    break;
                }
            }
            m = longer == null
                    ? new Match(c, "PART_IN_NAME", "HIGH", 90, null)
                    : new Match(c, "PART_IN_NAME", "MEDIUM", 84, "Stock part number is " + longer.raw);
        } else if (p.key.length() >= 5 && c.nameSkel.contains(p.skel)) {
            m = new Match(c, "PART_IN_NAME", "MEDIUM", 80,
                    "Spelling differs (O/0, I/1, S/5) — BOM " + p.raw);
        } else {
            for (Part t : c.parts) {
                Match x = null;
                // Ordering suffixes only follow a real part number with 3+ digits — "ESP32" of
                // "ESP32 S3 ETH" is a family name, and ESP32-WROOM-32E is a different product.
                boolean specific = digitCount(t.key) >= 3;
                if (specific && t.key.length() >= 5 && p.key.startsWith(t.key)
                        && orderingSuffix(p.key.substring(t.key.length()))) {
                    x = new Match(c, "SIMILAR_PART", "MEDIUM", 82,
                            "Ordering/package suffix differs — BOM " + p.raw + ", stock " + t.raw);
                } else if (specific && t.skel.length() >= 5 && p.skel.startsWith(t.skel)
                        && orderingSuffix(p.skel.substring(t.skel.length()))) {
                    x = new Match(c, "SIMILAR_PART", "MEDIUM", 79,
                            "Suffix and spelling differ — BOM " + p.raw + ", stock " + t.raw);
                } else if (p.core != null && t.core != null && p.core.length() >= 5 && p.coreSkel.equals(t.coreSkel)) {
                    x = variantConflict(p, t) || unconfirmedVariant(l, p, t, c)
                            ? new Match(c, "SIMILAR_PART", "LOW", 46, "Same base part " + p.core.toUpperCase(Locale.ROOT)
                                    + " but a different variant — BOM " + p.raw + ", stock " + t.raw)
                            : new Match(c, "SIMILAR_PART", "MEDIUM", 76, "Same base part " + p.core.toUpperCase(Locale.ROOT)
                                    + ", suffix differs — BOM " + p.raw + ", stock " + t.raw);
                } else if (p.digits != null && p.digits.equals(t.digits) && genericNumberAllowed(l.kind)) {
                    boolean known = l.kind != Kind.UNKNOWN && c.kind != Kind.UNKNOWN && compatible(l.kind, c.kind);
                    x = new Match(c, "SIMILAR_PART", known ? "MEDIUM" : "LOW", known ? 60 : 42,
                            "Same generic number " + p.digits + ", different maker prefix — BOM " + p.raw
                                    + ", stock " + t.raw);
                }
                m = better(m, x);
            }
        }
        if (m == null) {
            return null;
        }
        int s = m.score;
        String conf = m.confidence;
        String note = m.note;
        if (p.base) {
            // Matched on "AMS1117" of "AMS1117-3.3": likely, but the suffix may matter.
            s = Math.min(s, 78);
            conf = "HIGH".equals(conf) ? "MEDIUM" : conf;
            note = addNote(note, "Matched on base part " + p.raw);
            // A numbered or ADJ variant ("ADA4807-2" dual, "SRV05-4", "AMS1117-ADJ") is only a
            // suggestion unless the stock item states the same voltage version.
            String rest = p.rest == null ? "" : p.rest.toLowerCase(Locale.ROOT);
            boolean sameVoltage = l.voltage != null && c.voltage != null
                    && ElectronicsText.sameValue(l.voltage, c.voltage);
            boolean variant = (!rest.isEmpty() && Character.isDigit(rest.charAt(0))) || rest.startsWith("adj");
            if (variant && !sameVoltage && !c.nameKey.contains(p.key + key(p.rest))) {
                s = Math.min(s, 46);
                conf = "LOW";
                note = addNote(note, "BOM asks for the " + p.full + " variant — check the stock item is that one");
            }
        }
        if (p.weak) {
            // Found only in a description column ("RS-485 transceiver").
            s -= 20;
            conf = "HIGH".equals(conf) ? "MEDIUM" : conf;
        }
        return new Match(c, m.type, conf, s, note);
    }

    /** Part matches skip the conflict checks, so mark them down for what does not fit. */
    private static Match adjustPartMatch(Line l, Indexed c, Match m) {
        int s = m.score;
        String type = m.type;
        String conf = m.confidence;
        String note = m.note;
        if (!compatible(l.kind, c.kind)) {
            s -= 12;
        }
        if (icLike(l.kind) && icLike(c.kind) && l.voltage != null && c.voltage != null
                && !ElectronicsText.sameValue(l.voltage, c.voltage)) {
            s = Math.min(s, 44);
            type = "SIMILAR_PART";
            conf = "LOW";
            note = addNote(note, "Different voltage version — BOM needs " + volts(l.voltage)
                    + ", this stock item is " + volts(c.voltage));
        }
        if (l.mounting != null && c.mounting != null && !l.mounting.equals(c.mounting)) {
            s -= 2;
            note = addNote(note, "BOM says " + l.mounting + ", stock item is " + c.mounting);
        }
        if (c.zener && !l.zener) {
            s -= 4; // "D Zener 1N4148 5.1v" is not what a plain 1N4148 line wants
        }
        return new Match(c, type, conf, s, note);
    }

    /** Name text, value, colour and words. Caller has already ruled out conflicts. */
    private static Match textMatch(Line l, Indexed c) {
        if (l.nameKey.length() >= 2 && l.nameKey.equals(c.nameKey)) {
            return new Match(c, "EXACT", "HIGH", 95, null);
        }
        Match m = null;
        for (Part p : l.parts) {
            if (p.key.length() >= 5 && !c.descKey.isEmpty() && c.descKey.contains(p.key)) {
                m = better(m, new Match(c, "PART_IN_NAME", "MEDIUM", 70, "Found in the stock item's description"));
            }
        }
        // Containment is skipped for bare kind words ("Resistor", "LED") — those would pair
        // with every part of that kind.
        boolean cGeneric = GENERIC.contains(c.nameKey);
        boolean bomGeneric = GENERIC.contains(l.nameKey);
        if (!cGeneric && c.nameKey.length() >= 5
                && (l.nameKey.contains(c.nameKey) || key(l.row.part).contains(c.nameKey))) {
            m = better(m, new Match(c, "PART_IN_NAME", "MEDIUM", 58, null));
        }
        if (!bomGeneric && l.nameKey.length() >= 5 && c.nameKey.contains(l.nameKey)) {
            m = better(m, new Match(c, "PART_IN_NAME", "MEDIUM", 57, null));
        }
        if (!cGeneric && l.descKey.length() >= 8 && c.nameKey.length() >= 5 && l.descKey.contains(c.nameKey)) {
            m = better(m, new Match(c, "PART_IN_NAME", "MEDIUM", 55, null));
        }

        boolean kindsKnown = l.kind != Kind.UNKNOWN && c.kind != Kind.UNKNOWN;
        if (l.value != null && c.value != null && ElectronicsText.sameValue(l.value, c.value)) {
            m = better(m, new Match(c, "VALUE", kindsKnown ? "MEDIUM" : "LOW", kindsKnown ? 60 : 45, null));
        }
        if (l.color != null && l.color.equals(c.color) && (l.kind == Kind.LED || c.kind == Kind.LED)) {
            m = better(m, new Match(c, "VALUE", kindsKnown ? "MEDIUM" : "LOW", kindsKnown ? 60 : 45,
                    "Same LED colour (" + l.color + ")"));
        }
        m = better(m, wordMatch(l, c));
        return m;
    }

    /** Word overlap, tolerant of small spelling mistakes ("ferite" = "ferrite"). */
    private static Match wordMatch(Line l, Indexed c) {
        if (l.words.isEmpty() || c.words.isEmpty()) {
            return null;
        }
        int matchedB = 0;
        for (String b : l.words) {
            if (containsSimilar(c.words, b)) {
                matchedB++;
            }
        }
        int matchedI = 0;
        String longest = "";
        for (String w : c.words) {
            if (containsSimilar(l.words, w)) {
                matchedI++;
                if (w.length() > longest.length()) {
                    longest = w;
                }
            }
        }
        // Both name a specific product ("ST-Link" vs "Nu-Link", "12VDC" vs "5VDC") and the
        // names disagree: shared generic words like "link programmer" mean nothing.
        boolean bomUnmatched = l.distinct.stream().anyMatch(w -> !containsSimilar(c.words, w));
        boolean stockUnmatched = c.distinct.stream().anyMatch(w -> !containsSimilar(l.words, w));
        if (bomUnmatched && stockUnmatched) {
            return null;
        }
        double covB = (double) matchedB / l.words.size();
        double covI = (double) matchedI / c.words.size();
        int bonus = (int) Math.round(covB * 3 + covI * 3);
        if (covI == 1.0 && (c.words.size() >= 2 || longest.length() >= 4)) {
            return new Match(c, "WORDS", "MEDIUM", 52 + bonus, null);
        }
        if (covB == 1.0 && matchedB >= 2) {
            return new Match(c, "WORDS", "MEDIUM", 50 + bonus, null);
        }
        if (Math.min(matchedB, matchedI) >= 2 && Math.max(covB, covI) >= 0.6) {
            return new Match(c, "FUZZY", "LOW", 30 + bonus, null);
        }
        return null;
    }

    /** Size, rating and dielectric agreement nudge equal-value candidates apart. */
    private static Match withAttributeBonus(Line l, Indexed c, Match m) {
        int s = m.score;
        String note = m.note;
        if (l.size != null && l.size.equals(c.size)) {
            s += 5;
        }
        if (isCap(l, c) && l.voltage != null && c.voltage != null) {
            s += ElectronicsText.sameValue(l.voltage, c.voltage) ? 3 : 2; // conflicts() removed lower ratings
        } else if (isCap(l, c) && l.voltage != null) {
            note = addNote(note, "Stock item has no voltage rating recorded — check it is at least " + volts(l.voltage));
        }
        if (l.dielectric != null && l.dielectric.equals(c.dielectric)) {
            s += 3;
        } else if (l.dielectric == null && c.dielectric != null && !"CER".equals(c.dielectric)) {
            s -= 3; // BOM did not ask for tantalum / electrolytic
        }
        if (l.mounting != null && c.mounting != null && !l.mounting.equals(c.mounting)) {
            s -= 2;
            note = addNote(note, "BOM says " + l.mounting + ", stock item is " + c.mounting);
        }
        if (c.zener && !l.zener) {
            s -= 4;
        }
        return new Match(c, m.type, m.confidence, s, note);
    }

    /** A candidate is ruled out when value, size, colour, dielectric, rating or kind clearly differ. */
    private static boolean conflicts(Line l, Indexed c) {
        if (l.value != null && c.value != null && !ElectronicsText.sameValue(l.value, c.value)) {
            return true;
        }
        if (l.size != null && c.size != null && !l.size.equals(c.size)) {
            return true;
        }
        if (l.color != null && c.color != null && !l.color.equals(c.color)
                && (l.kind == Kind.LED || c.kind == Kind.LED)) {
            return true;
        }
        if (l.dielectric != null && c.dielectric != null && !l.dielectric.equals(c.dielectric)) {
            return true;
        }
        if (isCap(l, c) && l.voltage != null && c.voltage != null && c.voltage + 1e-9 < l.voltage) {
            return true; // a 16 V capacitor cannot stand in for a 25 V one
        }
        return !compatible(l.kind, c.kind);
    }

    private static boolean isCap(Line l, Indexed c) {
        return l.kind == Kind.CAP || (l.kind == Kind.UNKNOWN && c.kind == Kind.CAP);
    }

    private static boolean icLike(Kind k) {
        return k == Kind.IC || k == Kind.UNKNOWN;
    }

    /** "Same generic number" (LM7805 ~ KA7805) only makes sense for active parts. */
    private static boolean genericNumberAllowed(Kind k) {
        return k == Kind.IC || k == Kind.TRANSISTOR || k == Kind.DIODE || k == Kind.UNKNOWN;
    }

    /** After the shared base part, do the suffixes name different variants ("-3.3" vs "-5.0")? */
    private static boolean variantConflict(Part p, Part t) {
        String rp = p.key.startsWith(p.core) ? p.key.substring(p.core.length()) : "";
        String rt = t.key.startsWith(t.core) ? t.key.substring(t.core.length()) : "";
        int i = 0;
        while (i < rp.length() && i < rt.length() && rp.charAt(i) == rt.charAt(i) && Character.isLetter(rp.charAt(i))) {
            i++;
        }
        rp = rp.substring(i);
        rt = rt.substring(i);
        return !rp.isEmpty() && !rt.isEmpty() && Character.isDigit(rp.charAt(0)) && Character.isDigit(rt.charAt(0))
                && !rp.startsWith(rt) && !rt.startsWith(rp);
    }

    /**
     * The BOM names a numbered or adjustable variant right after the base part
     * ("ADA4807-2" dual, "AMS1117-ADJ", "LM2950-3.3") that the stock part number does not
     * repeat — unless the stock item states the same voltage, it may be the wrong one.
     */
    private static boolean unconfirmedVariant(Line l, Part p, Part t, Indexed c) {
        String rp = p.key.startsWith(p.core) ? p.key.substring(p.core.length()) : "";
        String rt = t.key.startsWith(t.core) ? t.key.substring(t.core.length()) : "";
        boolean bomVariant = (!rp.isEmpty() && Character.isDigit(rp.charAt(0))) || rp.startsWith("adj");
        if (!bomVariant || rt.startsWith(rp)) {
            return false;
        }
        return !(l.voltage != null && c.voltage != null && ElectronicsText.sameValue(l.voltage, c.voltage));
    }

    private static long digitCount(String s) {
        return s.chars().filter(Character::isDigit).count();
    }

    /** "DR", "LT1G", "ATMA2", "#PBF" — but not "ADJ", which names a different (adjustable) part. */
    private static boolean orderingSuffix(String rest) {
        return letterLed(rest) && !rest.startsWith("adj") && !rest.startsWith("ad1");
    }

    private static boolean letterLed(String rest) {
        return !rest.isEmpty() && Character.isLetter(rest.charAt(0));
    }

    private static Match better(Match a, Match b) {
        if (a == null) {
            return b;
        }
        if (b == null) {
            return a;
        }
        return b.score > a.score ? b : a;
    }

    private static String addNote(String note, String extra) {
        return note == null ? extra : note + "; " + extra;
    }

    private static String volts(double v) {
        return ElectronicsText.voltageOf(v + "V");
    }

    static int qty(Indexed c) {
        Integer q = c.c.getQuantity();
        return q == null ? 0 : q;
    }

    static boolean compatible(Kind a, Kind b) {
        if (a == Kind.UNKNOWN || b == Kind.UNKNOWN || a == b) {
            return true;
        }
        Set<Kind> diodeFamily = Set.of(Kind.DIODE, Kind.LED);
        return diodeFamily.contains(a) && diodeFamily.contains(b);
    }

    // ================================================================== part numbers

    private static final Pattern CORE = Pattern.compile("^(\\d?[A-Za-z]{1,6})[\\s-]?(\\d{3,})");
    private static final Pattern SUFFIX_VOLT = Pattern.compile("-(\\d{1,2}(?:\\.\\d{1,2})?)(?=$|[-/\\sVv])");
    private static final Set<String> SIZE_CODES = Set.of(
            "01005", "0201", "0402", "0603", "0805", "1206", "1210", "1812", "2010", "2512");

    /** A part number in its comparison forms. */
    static final class Part {
        final String raw;      // as written: "AMS1117-3.3"
        final String key;      // "ams11173.3"
        final String skel;     // look-alikes folded: o->0, i/l->1, s->5
        final String core;     // "ams1117": prefix + first 3+ digit run, or null
        final String coreSkel;
        final String digits;   // 4+ digit run of the core ("7805"), or null
        final boolean base;    // first piece of a longer token ("AMS1117" of "AMS1117-3.3")
        final String full;     // for a base piece: the whole token ("AMS1117-3.3"), else raw
        final String rest;     // for a base piece: what followed it ("3.3"), else null
        final boolean weak;    // found only in a description column
        final Double voltage;  // voltage version in a suffix: "-3.3", "-5.0", "-5-R7", "-33"

        Part(String raw, boolean weak) {
            this(raw, raw, null, weak);
        }

        Part(String raw, String full, String rest, boolean weak) {
            this.raw = raw;
            this.key = key(raw);
            this.skel = skel(key);
            this.base = rest != null;
            this.full = full;
            this.rest = rest;
            this.weak = weak;
            Matcher m = CORE.matcher(raw);
            if (m.find()) {
                this.core = (m.group(1) + m.group(2)).toLowerCase(Locale.ROOT);
                String d = m.group(2);
                this.digits = d.length() >= 4 && !SIZE_CODES.contains(d) ? d : null;
            } else {
                this.core = null;
                this.digits = null;
            }
            this.coreSkel = core == null ? null : skel(core);
            Matcher v = SUFFIX_VOLT.matcher(full);
            Double volt = null;
            if (v.find()) {
                volt = Double.valueOf(v.group(1));
                // "TLV1117-33", "-50", "-18": regulator codes for 3.3 V, 5.0 V, 1.8 V.
                if (!v.group(1).contains(".") && v.group(1).length() == 2 && volt >= 16) {
                    volt = volt / 10;
                }
            }
            this.voltage = volt;
        }
    }

    /** Part numbers in text, plus the base piece of hyphenated ones ("AMS1117" of "AMS1117-3.3"). */
    static List<Part> parts(String text, boolean weak) {
        List<Part> out = new ArrayList<>();
        for (String raw : ElectronicsText.partNumbers(text)) {
            out.add(new Part(raw, weak));
            String[] pieces = raw.split("[-#.]", 2);
            if (pieces.length == 2) {
                String b = pieces[0];
                long digits = b.chars().filter(Character::isDigit).count();
                // "ESP32" of "ESP32-WROOM-32E" names a family, not this part: a base piece
                // needs 3+ digits of its own or only a short suffix after it ("SRV05-4").
                if (b.length() >= 4 && ElectronicsText.looksLikePartNumber(b)
                        && (digits >= 3 || pieces[1].length() <= 3)) {
                    out.add(new Part(b, raw, pieces[1], weak));
                }
            }
        }
        return out;
    }

    // ================================================================== inventory side

    /** Pre-computed match keys for one inventory component. */
    static final class Indexed {
        final ComponentItem c;
        final String nameKey;
        final String nameSkel;
        final String codeKey;
        final String descKey;
        final List<Part> parts;
        final Set<String> partKeys = new HashSet<>();
        final Kind kind;
        final Double value;
        final String size;
        final String mounting;
        final String color;
        final String dielectric;
        final Double voltage;
        final boolean zener;
        final Set<String> words;
        final Set<String> distinct;

        Indexed(ComponentItem c) {
            this.c = c;
            String name = c.getComponentName();
            String category = c.getCategory() != null ? c.getCategory().getName() : null;
            String text = join(name, c.getType(), c.getValue(), c.getDescription());
            this.nameKey = key(name);
            this.nameSkel = skel(nameKey);
            this.codeKey = key(c.getItemCode());
            this.descKey = key(c.getDescription());
            this.parts = parts(name, false);
            for (Part p : parts) {
                partKeys.add(p.key);
            }
            // The name says what the part is; the category is only a fallback, because parts
            // get filed in the wrong category ("A03401A- PMOS" under Capacitor).
            Kind k = kindOfText(join(name, c.getType(), c.getDescription()));
            if (k == Kind.UNKNOWN) {
                k = kindOfText(category);
            }
            if (k == Kind.UNKNOWN) {
                k = kindFromValueUnit(name);
            }
            this.kind = k;
            this.zener = text.toLowerCase(Locale.ROOT).contains("zener");
            this.value = valueOf(kind, zener, c.getValue(), name, c.getDescription());
            this.size = ElectronicsText.sizeCode(text);
            this.mounting = ElectronicsText.mountingOf(text);
            this.color = colorOf(text);
            this.dielectric = dielectricOf(text);
            Double v = ElectronicsText.voltageValue(text);
            if (v == null) {
                for (Part p : parts) {
                    if (p.voltage != null) {
                        v = p.voltage;
                        break;
                    }
                }
            }
            this.voltage = v;
            this.words = words(join(name, c.getType()));
            this.distinct = distinct(words, join(name, c.getType()));
        }
    }

    // ================================================================== BOM side

    /** One BOM line prepared for matching. */
    static final class Line {
        final BomRow row;
        final Kind kind;
        final boolean nameIsValue;
        final List<Part> parts = new ArrayList<>();
        final String nameKey;
        final String descKey;
        final Double value;
        final String size;
        final String mounting;
        final String color;
        final String dielectric;
        final Double voltage;
        final boolean zener;
        final Set<String> words;
        final Set<String> distinct;

        Line(BomRow row) {
            this.row = row;
            this.kind = bomKind(row);
            // A name that is only a value ("10k", "100nF", "16MHz") identifies nothing by
            // itself — it must go through value matching, which checks kind and package.
            this.nameIsValue = isValueText(row.name, kind);
            parts.addAll(parts(row.part, false));
            if (!nameIsValue) {
                parts.addAll(parts(row.name, false));
            }
            parts.addAll(parts(row.value, false));
            parts.addAll(parts(row.description, true));
            this.nameKey = nameIsValue ? "" : key(row.name);
            this.descKey = key(row.description);
            String text = join(row.name, row.value, row.description);
            this.zener = text.toLowerCase(Locale.ROOT).contains("zener");
            this.value = bomValue(row, kind, zener);
            this.size = ElectronicsText.sizeCode(join(row.footprint, row.name, row.description, row.part));
            this.mounting = ElectronicsText.mountingOf(join(text, row.footprint));
            this.color = colorOf(join(text, row.footprint));
            this.dielectric = dielectricOf(text);
            Double v = null;
            for (Part p : parts) {
                if (p.voltage != null && !p.weak) {
                    v = p.voltage;
                    break;
                }
            }
            this.voltage = v != null ? v : ElectronicsText.voltageValue(text);
            this.words = words(join(row.part, row.name, row.description, row.value));
            this.distinct = distinct(words, join(row.part, row.name, row.description, row.value));
        }
    }

    // ================================================================== values

    private static Double valueOf(Kind kind, boolean zener, String valueField, String name, String desc) {
        if (kind == Kind.FUSE) {
            Double a = ElectronicsText.currentOf(join(valueField, name, desc));
            if (a != null) {
                return a;
            }
        }
        if (kind == Kind.DIODE && zener) {
            Double z = ElectronicsText.voltageValue(join(valueField, name, desc));
            if (z != null) {
                return z;
            }
        }
        Double v = ElectronicsText.siValue(valueField, false);
        if (v == null) {
            v = ElectronicsText.firstStrictSi(name);
        }
        if (v == null && kind == Kind.RES) {
            v = ElectronicsText.firstBareNumber(name); // "RES 220" = 220 ohm
        }
        return v;
    }

    /** BOM value: the Value column, else a value-looking token in the name/comment. */
    private static Double bomValue(BomRow row, Kind kind, boolean zener) {
        if (kind == Kind.FUSE) {
            Double a = ElectronicsText.currentOf(join(row.value, row.name, row.description));
            if (a != null) {
                return a;
            }
        }
        if (kind == Kind.DIODE && zener) {
            Double z = ElectronicsText.voltageValue(join(row.value, row.name, row.description));
            if (z != null) {
                return z;
            }
        }
        if (!blank(row.value)) {
            Double v = ElectronicsText.siValue(row.value, false);
            if (v != null) {
                return v;
            }
            v = ElectronicsText.firstStrictSi(row.value);
            if (v != null) {
                return v;
            }
        }
        Double v = ElectronicsText.firstStrictSi(row.name);
        if (v == null) {
            v = ElectronicsText.firstStrictSi(row.description);
        }
        if (v == null && kind == Kind.RES) {
            // On a resistor line a bare "100" means 100 ohm.
            String bare = firstNonBlank(row.value, row.name);
            if (ElectronicsText.isNumeric(bare)) {
                v = Double.parseDouble(bare.trim());
            }
        }
        return v;
    }

    /** True when the BOM name is just a value ("10k", "100nF", "16MHz", "100" on an R line). */
    private static boolean isValueText(String name, Kind kind) {
        if (blank(name) || ElectronicsText.looksLikePartNumber(name) || !ElectronicsText.partNumbers(name).isEmpty()) {
            return false; // "LM358N IC" names a part, it is not a value
        }
        String t = name.trim();
        if (ElectronicsText.siValue(t, true) != null) {
            return true;
        }
        if (kind == Kind.RES && ElectronicsText.isNumeric(t)) {
            return true;
        }
        if (ElectronicsText.firstStrictSi(t) == null) {
            return false;
        }
        // "1 nF", "16 Mhz", "10 K ohm" are values; "Cap 1 nF" also names the part, so its
        // name can match an inventory item called exactly that.
        for (String w : t.split("[\\s,]+")) {
            if (!VALUE_PIECE.matcher(w).matches()) {
                return false;
            }
        }
        return true;
    }

    private static final Pattern VALUE_PIECE = Pattern.compile(
            "(?i)^([\\d.]+[a-z]{0,4}|p|n|u|µ|m|k|meg|f|pf|nf|uf|µf|h|uh|mh|hz|khz|mhz|ohms?|Ω|r|e|v)$");

    // ================================================================== part kinds

    private static final Map<String, Kind> KIND_WORDS = new LinkedHashMap<>();
    static {
        for (String w : List.of("resistor", "resistance", "res")) KIND_WORDS.put(w, Kind.RES);
        for (String w : List.of("potentiometer", "pot", "trimmer", "trimpot", "preset", "rheostat")) KIND_WORDS.put(w, Kind.POT);
        for (String w : List.of("capacitor", "capacitance", "cap", "electrolytic", "tantalum", "mlcc", "supercap",
                "supercapacitor")) KIND_WORDS.put(w, Kind.CAP);
        for (String w : List.of("inductor", "choke", "ind")) KIND_WORDS.put(w, Kind.IND);
        for (String w : List.of("ferrite", "bead")) KIND_WORDS.put(w, Kind.FERRITE);
        KIND_WORDS.put("led", Kind.LED);
        for (String w : List.of("diode", "zener", "schottky", "rectifier", "tvs", "esd")) KIND_WORDS.put(w, Kind.DIODE);
        for (String w : List.of("crystal", "xtal", "oscillator", "resonator")) KIND_WORDS.put(w, Kind.XTAL);
        for (String w : List.of("ic", "mcu", "microcontroller", "regulator", "ldo", "opamp", "amplifier", "comparator",
                "converter", "driver", "eeprom", "transceiver", "timer", "rtc", "dac", "adc", "optocoupler", "opto",
                "optoisolator", "buck", "boost", "counter", "reference", "controller")) KIND_WORDS.put(w, Kind.IC);
        for (String w : List.of("transistor", "mosfet", "fet", "bjt", "jfet", "npn", "pnp", "pmos", "nmos", "igbt",
                "darlington")) KIND_WORDS.put(w, Kind.TRANSISTOR);
        for (String w : List.of("connector", "header", "pinheader", "jst", "socket", "terminal", "holder", "conn",
                "receptacle")) KIND_WORDS.put(w, Kind.CONN);
        for (String w : List.of("fuse", "polyfuse")) KIND_WORDS.put(w, Kind.FUSE);
        KIND_WORDS.put("relay", Kind.RELAY);
        for (String w : List.of("switch", "button", "tactile", "pushbutton", "tact")) KIND_WORDS.put(w, Kind.SWITCH);
    }

    /** When text names several kinds: "fuse holder" is a connector, "MOSFET driver" an IC. */
    private static final List<Kind> PRIORITY = List.of(Kind.FERRITE, Kind.POT, Kind.CONN, Kind.LED, Kind.RES,
            Kind.CAP, Kind.IND, Kind.XTAL, Kind.IC, Kind.DIODE, Kind.TRANSISTOR, Kind.FUSE, Kind.RELAY, Kind.SWITCH);

    /** Kind from designator prefix first (R1 -> resistor), then value unit, then words. */
    static Kind bomKind(BomRow row) {
        String text = join(row.name, row.description, row.footprint);
        if (!blank(row.designators)) {
            String first = row.designators.trim().split("[,;\\s]+")[0];
            // Leading letters only: "R4-R7" -> "R", "LED3" -> "LED", "SW1" -> "SW".
            Matcher lead = Pattern.compile("^([A-Za-z]+)").matcher(first);
            String prefix = lead.find() ? lead.group(1).toUpperCase(Locale.ROOT) : "";
            Kind k = switch (prefix) {
                case "R", "RN" -> Kind.RES;
                case "RV", "VR", "POT" -> Kind.POT;
                case "C", "CP" -> Kind.CAP;
                case "L" -> Kind.IND;
                case "FB", "FL" -> Kind.FERRITE;
                case "D", "CR", "ZD" -> Kind.DIODE;
                case "LED", "DS" -> Kind.LED;
                case "Q" -> Kind.TRANSISTOR;
                case "U", "IC" -> Kind.IC;
                case "Y", "XTAL" -> Kind.XTAL;
                case "J", "P", "CN", "CON", "JP" -> Kind.CONN;
                case "F" -> Kind.FUSE;
                case "SW", "S" -> Kind.SWITCH;
                case "K", "RL" -> Kind.RELAY;
                default -> Kind.UNKNOWN;
            };
            // LEDs often carry a plain "D" designator.
            if (k == Kind.DIODE && kindOfText(join(text, row.value)) == Kind.LED) {
                return Kind.LED;
            }
            if (k != Kind.UNKNOWN) {
                return k;
            }
        }
        if (!blank(row.value)) {
            String v = row.value.toLowerCase(Locale.ROOT);
            if (v.contains("ω") || v.contains("ohm") || v.contains("Ω")) {
                return Kind.RES;
            }
            if (v.matches(".*\\d\\s*[pnum]?f\\b.*")) {
                return Kind.CAP;
            }
            if (v.matches(".*\\d\\s*[pnum]?h\\b.*")) {
                return Kind.IND;
            }
        }
        Kind k = kindOfText(join(text, row.value));
        if (k != Kind.UNKNOWN) {
            return k;
        }
        k = kindFromValueUnit(firstNonBlank(row.value, row.name));
        return k != Kind.UNKNOWN ? k : kindFromValueUnit(row.description);
    }

    /** "22 pf" -> capacitor, "12 mhz" -> crystal, "4k7" / "100E" -> resistor. */
    static Kind kindFromValueUnit(String text) {
        ElectronicsText.ValueMatch vm = ElectronicsText.findValue(text);
        if (vm == null) {
            return Kind.UNKNOWN;
        }
        String unit = ElectronicsText.unitOf(vm.token());
        if (unit != null) {
            return switch (unit) {
                case "F" -> Kind.CAP;
                case "H" -> Kind.IND;
                case "Hz" -> Kind.XTAL;
                case "Ω" -> Kind.RES;
                default -> Kind.UNKNOWN;
            };
        }
        char p = ElectronicsText.prefixOf(vm.token());
        return p == 'k' || p == 'K' || p == 'M' ? Kind.RES : Kind.UNKNOWN;
    }

    static Kind kindOfText(String text) {
        if (blank(text)) {
            return Kind.UNKNOWN;
        }
        String low = " " + text.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ") + " ";
        Set<Kind> found = EnumSet.noneOf(Kind.class);
        if (low.contains(" push button ")) found.add(Kind.SWITCH);
        if (low.contains(" op amp ")) found.add(Kind.IC);
        if (low.contains(" light emitting ")) found.add(Kind.LED);
        if (low.contains(" terminal block ")) found.add(Kind.CONN);
        for (String w : low.trim().split(" ")) {
            if (w.isEmpty()) {
                continue;
            }
            String s = stem(w);
            Kind k = KIND_WORDS.get(s);
            if (k == null) {
                k = KIND_WORDS.get(w);
            }
            if (k == null && s.length() >= 5 && s.matches("[a-z]+")) {
                k = fuzzyKindWord(s);
            }
            if (k != null) {
                found.add(k);
            }
        }
        for (Kind k : PRIORITY) {
            if (found.contains(k)) {
                return k;
            }
        }
        return Kind.UNKNOWN;
    }

    /** "capasitor", "resister", "crystl", "ferite", "tantulum" -> their kind. */
    private static Kind fuzzyKindWord(String w) {
        for (Map.Entry<String, Kind> e : KIND_WORDS.entrySet()) {
            String kw = e.getKey();
            if (kw.length() >= 6 && similar(w, kw)) {
                return e.getValue();
            }
        }
        return null;
    }

    // ================================================================== attributes

    private static final List<String> COLORS = List.of(
            "red", "green", "blue", "yellow", "white", "orange", "amber", "rgb", "pink", "purple", "violet");

    static String colorOf(String text) {
        if (blank(text)) {
            return null;
        }
        String low = " " + text.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ") + " ";
        for (String c : COLORS) {
            if (low.contains(" " + c + " ")) {
                return c;
            }
        }
        return null;
    }

    /** "TANT", "ELEC", "CER" or null — misspellings like "tantulum" included. */
    static String dielectricOf(String text) {
        if (blank(text)) {
            return null;
        }
        for (String w : text.toLowerCase(Locale.ROOT).split("[^a-z0-9]+")) {
            if (w.equals("tant") || similar(w, "tantalum")) return "TANT";
            if (w.equals("elec") || w.equals("electrolytic") || similar(w, "electrolytic") || w.startsWith("alumin")) return "ELEC";
            if (w.equals("ceramic") || w.equals("mlcc") || w.equals("x7r") || w.equals("x5r") || w.equals("c0g")
                    || w.equals("np0") || w.equals("y5v")) return "CER";
        }
        return null;
    }

    // ================================================================== text helpers

    /** Bare part-kind words: too generic to match on by themselves. */
    private static final Set<String> GENERIC = Set.of(
            "resistor", "resistors", "capacitor", "capacitors", "inductor", "inductors", "diode", "diodes", "led",
            "leds", "transistor", "transistors", "crystal", "connector", "connectors", "header", "fuse", "switch",
            "relay", "ic", "module", "sensor", "sensors", "component", "components", "part", "parts",
            "res", "cap", "ind", "smd", "tht");

    private static final Set<String> STOPWORDS = Set.of(
            "the", "and", "for", "with", "pcs", "nos", "qty", "of", "to", "in", "on", "smd", "tht", "pin", "pins",
            "type", "module", "board", "part", "new", "push", "rohs");

    /** Lower-case, Greek mu -> u, "ohm"/Ω removed, then only [a-z0-9.] kept. */
    static String key(String s) {
        if (blank(s)) {
            return "";
        }
        return s.toLowerCase(Locale.ROOT)
                .replace('µ', 'u').replace('μ', 'u')
                .replace("ω", "").replace("Ω", "")
                .replace("ohms", "").replace("ohm", "")
                .replaceAll("[^a-z0-9.]", "");
    }

    /** Folds characters people swap when typing part numbers: O/0, I/1, l/1, S/5. */
    static String skel(String key) {
        return key.replace('o', '0').replace('i', '1').replace('l', '1').replace('s', '5');
    }

    /**
     * Informative words for word matching: stemmed ("switches" -> "switch"), without values
     * (handled by value matching), bare numbers, kind words and filler.
     */
    static Set<String> words(String s) {
        if (blank(s)) {
            return Collections.emptySet();
        }
        Set<String> out = new HashSet<>();
        // Hyphenated names keep their short parts together: "ST-Link" -> "stlink", so it
        // is not mistaken for "Nu-Link" just because both end in "link".
        out.addAll(hyphenWords(s));
        for (String tok : s.toLowerCase(Locale.ROOT).replace('µ', 'u').split("[^a-z0-9.]+")) {
            String t = stem(tok.replaceAll("^\\.+|\\.+$", ""));
            if (t.equals("pushbutton")) {
                t = "button";
            }
            if (t.length() < 3 || STOPWORDS.contains(t) || GENERIC.contains(t)) {
                continue;
            }
            if (!t.matches(".*[a-z].*")) {
                if (t.contains(".")) {
                    out.add(t); // "2.54" pitch
                }
                continue;
            }
            if (ElectronicsText.siValue(t, true) != null) {
                continue;
            }
            out.add(t);
            Matcher mm = Pattern.compile("^(\\d+\\.\\d+)mm$").matcher(t);
            if (mm.matches()) {
                out.add(mm.group(1)); // "2.54mm" also matches a bare "2.54"
            }
        }
        return out;
    }

    private static final Pattern HYPHEN_NAME = Pattern.compile(
            "(?i)\\b([a-z0-9]{1,3})-([a-z][a-z0-9]{2,})\\b");

    /** "ST-Link" -> "stlink", "Nu-Link" -> "nulink": short hyphenated names kept whole. */
    private static Set<String> hyphenWords(String text) {
        Set<String> out = new HashSet<>();
        if (blank(text)) {
            return out;
        }
        Matcher hy = HYPHEN_NAME.matcher(text);
        while (hy.find()) {
            out.add((hy.group(1) + hy.group(2)).toLowerCase(Locale.ROOT));
        }
        return out;
    }

    /** Identifying words: hyphenated names ("stlink") and words with digits ("12vdc", "6mm"). */
    private static Set<String> distinct(Set<String> words, String text) {
        Set<String> out = new HashSet<>(hyphenWords(text));
        out.retainAll(words);
        for (String w : words) {
            if (w.chars().anyMatch(Character::isDigit)) {
                out.add(w);
            }
        }
        return out;
    }

    private static String stem(String w) {
        if (!w.matches("[a-z]+") || w.length() <= 3) {
            return w;
        }
        if (w.endsWith("ches") || w.endsWith("shes") || w.endsWith("sses") || w.endsWith("xes")) {
            return w.substring(0, w.length() - 2);
        }
        if (w.endsWith("s") && !w.endsWith("ss")) {
            return w.substring(0, w.length() - 1);
        }
        return w;
    }

    private static boolean containsSimilar(Set<String> set, String w) {
        if (set.contains(w)) {
            return true;
        }
        for (String s : set) {
            if (similar(w, s)) {
                return true;
            }
        }
        return false;
    }

    /** Letters-only words of 5+ characters one typo apart (two for 8+): "ferite" ~ "ferrite". */
    static boolean similar(String a, String b) {
        if (a.equals(b)) {
            return true;
        }
        int min = Math.min(a.length(), b.length());
        if (min < 5 || !a.matches("[a-z]+") || !b.matches("[a-z]+")) {
            return false;
        }
        int allowed = min >= 8 ? 2 : 1;
        if (Math.abs(a.length() - b.length()) > allowed) {
            return false;
        }
        return levenshtein(a, b, allowed) <= allowed;
    }

    private static int levenshtein(String a, String b, int limit) {
        int[] prev = new int[b.length() + 1];
        int[] cur = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) {
            prev[j] = j;
        }
        for (int i = 1; i <= a.length(); i++) {
            cur[0] = i;
            int rowMin = cur[0];
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                cur[j] = Math.min(Math.min(cur[j - 1] + 1, prev[j] + 1), prev[j - 1] + cost);
                rowMin = Math.min(rowMin, cur[j]);
            }
            if (rowMin > limit) {
                return limit + 1;
            }
            int[] t = prev;
            prev = cur;
            cur = t;
        }
        return prev[b.length()];
    }

    static String join(String... parts) {
        StringBuilder sb = new StringBuilder();
        for (String p : parts) {
            if (!blank(p)) {
                if (sb.length() > 0) {
                    sb.append(' ');
                }
                sb.append(p);
            }
        }
        return sb.toString();
    }

    static String firstNonBlank(String... values) {
        for (String v : values) {
            if (!blank(v)) {
                return v;
            }
        }
        return null;
    }

    static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
