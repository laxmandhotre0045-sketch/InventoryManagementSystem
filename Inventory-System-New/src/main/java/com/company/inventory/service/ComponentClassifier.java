package com.company.inventory.service;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.company.inventory.dto.response.ComponentClassification;
import com.company.inventory.entity.ComponentCategory;
import com.company.inventory.entity.ComponentItem;
import com.company.inventory.repository.ComponentCategoryRepository;
import com.company.inventory.repository.ComponentRepository;

/**
 * Suggests where a new item belongs in the inventory — Category › Type › Value, e.g.
 * "Capacitor › SMD › 100nF" — from its name/description, the source's own category
 * hint and (from the AI) its mounting.
 *
 * <p>The category is chosen from the categories that already exist, and follows the
 * user's own filing habits: if every ferrite bead so far lives under "Resistor", a new
 * one is suggested there too instead of inventing a new category. A suggestion only —
 * every caller shows it to the user for confirmation before anything is saved.</p>
 *
 * <p>Read-only: it never writes to the database.</p>
 */
@Component
public class ComponentClassifier {

    private static final String SEP = " › ";

    private final ComponentCategoryRepository categoryRepository;
    private final ComponentRepository componentRepository;

    public ComponentClassifier(ComponentCategoryRepository categoryRepository,
                               ComponentRepository componentRepository) {
        this.categoryRepository = categoryRepository;
        this.componentRepository = componentRepository;
    }

    /** What an item is, detected from keywords. Order matters: specific before general. */
    enum Concept {
        PROGRAMMER("programmer / debugger", List.of("programmer", "debugger", "st-link", "st link", "j-link", "jlink", "nu-link"),
                List.of("Programmer", "Programmers"), null),
        POT("potentiometer", List.of("potentiometer", "trimmer", "trimpot", " preset", " pot "),
                List.of("Potentiometer", "Potentiometers"), "Ω"),
        FERRITE("ferrite bead", List.of("ferrite"), List.of("Ferrite Bead", "Ferrite", "Inductor"), "Ω"),
        CONVERTER("DC-DC converter", List.of("dc-dc", "dc dc", " buck", "step-down", "step down", "step-up", "step up",
                "boost converter"), List.of("DC-DC Converters", "DC-DC Converter"), null),
        DISPLAY("display", List.of("display", "oled", " lcd", " tft", "7-segment", "seven segment"),
                List.of("Display", "Displays"), null),
        SENSOR("sensor", List.of("sensor"), List.of("Sensor", "Sensors"), null),
        MODULE("module / board", List.of(" module", "board", "shield", "breakout", "devkit", "dev kit", "development kit"),
                List.of("Module", "Modules"), null),
        XTAL("crystal / oscillator", List.of("crystal", "oscillator", " xtal", "resonator"),
                List.of("Crystal Oscillator", "Crystal", "Crystals"), "Hz"),
        LED("LED", List.of(" led ", " leds "), List.of("LED", "LEDs", "Diode"), null),
        DIODE("diode", List.of("diode", "zener", "schottky", "rectifier", " tvs"), List.of("Diode", "Diodes"), null),
        TRANSISTOR("transistor", List.of("transistor", "mosfet", " bjt", " jfet", " npn", " pnp", "igbt"),
                List.of("Transistor", "Transistors"), null),
        MCU("microcontroller", List.of("microcontroller", " mcu", "atmega", "attiny", "stm32", "esp32", "esp8266",
                "pic16", "pic18", " 8051"), List.of("Microcontroller", "Microcontrollers"), null),
        CAP("capacitor", List.of("capacit", " cap ", "tantalum", "electrolytic", " mlcc"),
                List.of("Capacitor", "Capacitors"), "F"),
        IND("inductor", List.of("inductor", " ind ", " choke"), List.of("Inductor", "Inductors"), "H"),
        RES("resistor", List.of("resist", " res ", "ohm"), List.of("Resistor", "Resistors"), "Ω"),
        RELAY("relay", List.of(" relay"), List.of("Relay", "Relays", "Switches"), null),
        SWITCH("switch", List.of(" switch", "push button", "pushbutton", "tactile"), List.of("Switches", "Switch"), null),
        CONN("connector", List.of("connector", "header", " jst", "terminal", "socket", "holder", " berg"),
                List.of("Connector", "Connectors"), null),
        FUSE("fuse", List.of(" fuse", "polyfuse", " ptc "), List.of("Fuse", "Fuses"), null),
        POWER("power supply", List.of("power supply", " smps", " adapter", " psu", "h-link", "hlink"),
                List.of("Power supply", "Power Supply"), null),
        IC("IC", List.of(" ic ", "regulator", " ldo", "op-amp", "op amp", "opamp", "amplifier", "comparator", "timer",
                "eeprom", "transceiver", " driver", " adc", " dac", " rtc", "real-time clock", "optoisolator",
                "optocoupler", "counter", "voltage reference", "current source"),
                List.of("IC", "ICs", "Integrated Circuit", "Integrated Circuits"), null);

        final String label;
        final List<String> keywords;
        final List<String> categoryNames;
        final String unit;

        Concept(String label, List<String> keywords, List<String> categoryNames, String unit) {
            this.label = label;
            this.keywords = keywords;
            this.categoryNames = categoryNames;
            this.unit = unit;
        }
    }

    // ------------------------------------------------------------------ sessions

    /**
     * Loads the categories and the filing habits once; classify as many items as needed
     * with the returned session (e.g. every line of one invoice).
     */
    @Transactional(readOnly = true)
    public Session session() {
        List<Cat> cats = new ArrayList<>();
        for (ComponentCategory c : categoryRepository.findAll()) {
            cats.add(new Cat(c.getId(), c.getName()));
        }
        Map<Concept, Map<String, Integer>> habits = new EnumMap<>(Concept.class);
        for (ComponentItem c : componentRepository.findAll()) {
            String category = c.getCategory() != null ? c.getCategory().getName() : null;
            if (category == null) {
                continue;
            }
            Concept concept = detect(norm(join(category, c.getType(), c.getComponentName(), c.getDescription())),
                    c.getComponentName());
            if (concept != null) {
                habits.computeIfAbsent(concept, k -> new HashMap<>()).merge(category, 1, Integer::sum);
            }
        }
        return new Session(cats, habits);
    }

    private record Cat(Long id, String name) { }

    public static final class Session {
        private final List<Cat> categories;
        private final Map<Concept, Map<String, Integer>> habits;

        private Session(List<Cat> categories, Map<Concept, Map<String, Integer>> habits) {
            this.categories = categories;
            this.habits = habits;
        }

        /**
         * @param name         item name as written (invoice line, voice, ...)
         * @param description  extra text, may be null
         * @param categoryHint the source's own category text (e.g. the AI's guess), may be null
         * @param mountingHint "SMD"/"THT" from the AI when the text itself does not say, may be null
         */
        public ComponentClassification classify(String name, String description, String categoryHint,
                                                String mountingHint) {
            String nameText = join(name, description);
            String normalised = norm(join(name, description, categoryHint));
            Concept concept = detect(normalised, name);

            ComponentClassification out = new ComponentClassification();

            // ---- category ----
            Cat hintCat = findCategory(categoryHint);
            if (hintCat != null) {
                setCategory(out, hintCat, "Matches the source's category \"" + categoryHint.trim() + "\"");
            } else if (concept != null) {
                String habit = habitCategory(concept);
                Cat habitCat = habit != null ? findCategory(habit) : null;
                if (habitCat != null) {
                    int n = habits.get(concept).get(habit);
                    setCategory(out, habitCat, "Detected " + article(concept.label) + " " + concept.label
                            + "; your other " + n + " " + concept.label + " items are filed under \""
                            + habitCat.name() + "\"");
                } else {
                    Cat byName = null;
                    for (String candidate : concept.categoryNames) {
                        byName = findCategory(candidate);
                        if (byName != null) {
                            break;
                        }
                    }
                    if (byName != null) {
                        setCategory(out, byName, "Detected " + article(concept.label) + " " + concept.label
                                + " from the name");
                    } else {
                        out.setCategory(concept.categoryNames.get(0));
                        out.setCategoryIsNew(true);
                        out.setReason("Detected " + article(concept.label) + " " + concept.label
                                + "; no such category yet — it will be created");
                    }
                }
            } else if (!blank(categoryHint)) {
                out.setCategory(categoryHint.trim());
                out.setCategoryIsNew(true);
                out.setReason("Using the source's category \"" + categoryHint.trim() + "\" (new)");
            } else {
                Cat other = findCategory("Other");
                if (other != null) {
                    setCategory(out, other, "Could not tell what this is — please choose a category");
                } else {
                    out.setCategory("Uncategorized");
                    out.setCategoryIsNew(true);
                    out.setReason("Could not tell what this is — please choose a category");
                }
            }

            // ---- type (mounting) ----
            String type = ElectronicsText.mountingOf(nameText);
            if (type == null && looksLikeModule(norm(nameText), concept)) {
                type = "Module";
            }
            if (type == null && ("SMD".equalsIgnoreCase(mountingHint) || "THT".equalsIgnoreCase(mountingHint))) {
                type = mountingHint.toUpperCase(Locale.ROOT);
            }
            out.setType(type);

            // ---- value ----
            out.setValue(valueFor(concept, name, description));

            StringBuilder path = new StringBuilder(out.getCategory());
            if (out.getType() != null) {
                path.append(SEP).append(out.getType());
            }
            if (out.getValue() != null) {
                path.append(SEP).append(out.getValue());
            }
            out.setPath(path.toString());
            return out;
        }

        /** Most common category for this kind of item — only when it is a clear habit. */
        private String habitCategory(Concept concept) {
            Map<String, Integer> counts = habits.get(concept);
            if (counts == null || counts.isEmpty()) {
                return null;
            }
            int total = counts.values().stream().mapToInt(Integer::intValue).sum();
            Map.Entry<String, Integer> top = counts.entrySet().stream()
                    .max(Map.Entry.comparingByValue()).orElse(null);
            if (top != null && top.getValue() >= 2 && top.getValue() * 2 > total) {
                return top.getKey();
            }
            return null;
        }

        private Cat findCategory(String name) {
            if (blank(name)) {
                return null;
            }
            Set<String> wanted = variants(name);
            for (Cat c : categories) {
                for (String v : variants(c.name())) {
                    if (wanted.contains(v)) {
                        return c;
                    }
                }
            }
            return null;
        }

        private static void setCategory(ComponentClassification out, Cat cat, String reason) {
            out.setCategoryId(cat.id());
            out.setCategory(cat.name());
            out.setCategoryIsNew(false);
            out.setReason(reason);
        }
    }

    // ------------------------------------------------------------------ detection

    private static Concept detect(String normalised, String name) {
        for (Concept c : Concept.values()) {
            for (String k : c.keywords) {
                if (normalised.contains(k)) {
                    return c;
                }
            }
        }
        // No keyword: judge by the value's unit ("100nF" -> capacitor, "4k7" -> resistor).
        ElectronicsText.ValueMatch vm = ElectronicsText.findValue(name);
        if (vm == null) {
            return null;
        }
        String unit = ElectronicsText.unitOf(vm.token());
        if (unit != null) {
            return switch (unit) {
                case "F" -> Concept.CAP;
                case "H" -> Concept.IND;
                case "Hz" -> Concept.XTAL;
                default -> Concept.RES;
            };
        }
        char p = ElectronicsText.prefixOf(vm.token());
        if (p == 'p' || p == 'P' || p == 'n' || p == 'N' || p == 'u' || p == 'U') {
            return Concept.CAP;
        }
        if (p == 'k' || p == 'K' || p == 'M') {
            return Concept.RES;
        }
        return null;
    }

    private static boolean looksLikeModule(String normalised, Concept concept) {
        if (concept == Concept.MODULE || concept == Concept.PROGRAMMER || concept == Concept.POWER) {
            return true;
        }
        for (String k : Concept.MODULE.keywords) {
            if (normalised.contains(k)) {
                return true;
            }
        }
        return false;
    }

    private static final List<String> COLOURS = List.of(
            "red", "green", "blue", "yellow", "white", "orange", "amber", "warm white", "rgb", "ir", "uv", "pink", "purple");

    /** The value level of the path: an electrical value, a zener voltage, an LED colour or a part number. */
    private static String valueFor(Concept concept, String name, String description) {
        String text = join(name, description);
        if (concept != null && concept.unit != null) {
            ElectronicsText.ValueMatch vm = ElectronicsText.findValue(name);
            if (vm == null) {
                vm = ElectronicsText.findValue(description);
            }
            String formatted = null;
            if (vm != null) {
                String unit = ElectronicsText.unitOf(vm.token());
                formatted = ElectronicsText.formatValue(vm.value(), unit != null ? unit : concept.unit);
            } else if (concept == Concept.RES || concept == Concept.POT) {
                Double bare = ElectronicsText.firstBareNumber(name);
                if (bare != null) {
                    formatted = ElectronicsText.formatValue(bare, "Ω");
                }
            }
            if (formatted != null && concept == Concept.CAP) {
                String volts = ElectronicsText.voltageOf(text);
                if (volts != null) {
                    formatted = formatted + " " + volts;
                }
            }
            if (formatted != null) {
                return formatted;
            }
        }
        if (concept == Concept.DIODE && norm(text).contains("zener")) {
            String volts = ElectronicsText.voltageOf(text);
            if (volts != null) {
                return volts;
            }
        }
        if (concept == Concept.LED) {
            String t = norm(text);
            for (String colour : COLOURS) {
                if (t.contains(" " + colour + " ")) {
                    return Character.toUpperCase(colour.charAt(0)) + colour.substring(1);
                }
            }
        }
        return ElectronicsText.primaryPartNumber(name);
    }

    // ------------------------------------------------------------------ text helpers

    /** "an IC", "an LED", "an oscillator", "a resistor" — by how the label is spoken. */
    static String article(String label) {
        if (label == null || label.isEmpty()) {
            return "a";
        }
        if (label.equals("IC") || label.equals("LED")) {
            return "an";
        }
        return "aeiouAEIOU".indexOf(label.charAt(0)) >= 0 ? "an" : "a";
    }

    /** Lower-case, punctuation to spaces (hyphens kept), padded with spaces for word matching. */
    static String norm(String s) {
        if (blank(s)) {
            return " ";
        }
        return " " + s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9.+\\-]+", " ").trim() + " ";
    }

    /** "Capacitors" == "Capacitor", "Switches" == "Switch", "DC-DC Converters" == "dc dc converter". */
    private static Set<String> variants(String name) {
        String n = name.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        Set<String> out = new HashSet<>();
        out.add(n);
        if (n.endsWith("es") && n.length() > 4) {
            out.add(n.substring(0, n.length() - 2));
        }
        if (n.endsWith("s") && n.length() > 3) {
            out.add(n.substring(0, n.length() - 1));
        }
        return out;
    }

    private static String join(String... parts) {
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

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
