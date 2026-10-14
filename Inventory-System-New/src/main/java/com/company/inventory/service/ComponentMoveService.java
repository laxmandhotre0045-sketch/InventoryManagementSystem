package com.company.inventory.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.company.inventory.dto.request.MoveToEquipmentRequest;
import com.company.inventory.dto.response.MoveToEquipmentResult;
import com.company.inventory.dto.response.SpecificationEntry;
import com.company.inventory.entity.ComponentItem;
import com.company.inventory.entity.ComponentStatus;
import com.company.inventory.entity.Equipment;
import com.company.inventory.entity.ItemSpecification;
import com.company.inventory.exception.ResourceNotFoundException;
import com.company.inventory.repository.ComponentRepository;
import com.company.inventory.repository.EquipmentRepository;

/**
 * Moves a component that is really equipment (a module, board, programmer…) into the
 * Equipment register.
 *
 * <p>Equipment is tracked per physical unit, so a component with quantity N becomes N
 * equipment records, each with its own code. The component itself is <b>archived, not
 * deleted</b> — its history (stock movements, purchases) stays intact and it can be
 * restored. Its specifications are copied to every new unit.</p>
 */
@Service
@Transactional
public class ComponentMoveService {

    /** Guard against moving a bulk part (e.g. 1000 resistors) by mistake. */
    public static final int MAX_UNITS = 200;

    private static final Pattern SUPPLIER_CODE = Pattern.compile("^\\s*\\[([^\\]]+)\\]\\s*");

    private final ComponentRepository componentRepository;
    private final EquipmentRepository equipmentRepository;
    private final ItemCodeGenerator itemCodeGenerator;
    private final SpecificationService specificationService;

    public ComponentMoveService(ComponentRepository componentRepository,
                                EquipmentRepository equipmentRepository,
                                ItemCodeGenerator itemCodeGenerator,
                                SpecificationService specificationService) {
        this.componentRepository = componentRepository;
        this.equipmentRepository = equipmentRepository;
        this.itemCodeGenerator = itemCodeGenerator;
        this.specificationService = specificationService;
    }

    public MoveToEquipmentResult moveToEquipment(Long componentId, MoveToEquipmentRequest request, boolean dryRun) {
        ComponentItem c = componentRepository.findById(componentId)
                .orElseThrow(() -> new ResourceNotFoundException("Component not found with id: " + componentId));
        if (c.getStatus() == ComponentStatus.ARCHIVED) {
            throw new IllegalArgumentException("\"" + c.getComponentName()
                    + "\" is archived (already moved or deleted). Restore it first if you want to move it.");
        }
        int qty = c.getQuantity() == null ? 0 : c.getQuantity();
        int units = Math.max(qty, 1);
        if (units > MAX_UNITS) {
            throw new IllegalArgumentException("\"" + c.getComponentName() + "\" has " + qty
                    + " units. Equipment is recorded one per unit, so moving more than " + MAX_UNITS
                    + " at once is blocked — this looks like a stock part, not equipment.");
        }
        MoveToEquipmentRequest req = request != null ? request : new MoveToEquipmentRequest();

        String originalName = c.getComponentName();
        Matcher m = SUPPLIER_CODE.matcher(originalName);
        String supplierCode = m.find() ? m.group(1).trim() : null;
        String cleanName = SUPPLIER_CODE.matcher(originalName).replaceFirst("").trim();
        if (cleanName.isEmpty()) {
            cleanName = originalName;
        }
        String text = joinWith(" ", originalName, c.getDescription(), c.getType());

        MoveToEquipmentResult out = new MoveToEquipmentResult();
        out.setDryRun(dryRun);
        out.setComponentId(c.getId());
        out.setComponentItemCode(c.getItemCode());
        out.setComponentName(originalName);
        out.setUnits(units);
        out.setEquipmentName(truncate(firstNonBlank(req.getName(), cleanName), 150));
        out.setEquipmentCategory(truncate(firstNonBlank(req.getEquipmentCategory(), suggestCategory(text)), 100));
        out.setManufacturer(truncate(firstNonBlank(req.getManufacturer(), suggestManufacturer(text)), 120));
        out.setLocation(truncate(joinWith(" · ",
                c.getRackNo() != null && !c.getRackNo().isBlank() ? "Rack " + c.getRackNo().trim() : null,
                c.getLocation()), 120));
        out.setStatus(c.getStatus() == ComponentStatus.INACTIVE ? "INACTIVE" : "ACTIVE");

        List<SpecificationEntry> specs = new ArrayList<>(specificationService.get(ItemSpecification.COMPONENT, c.getId()));
        if (supplierCode != null) {
            specs.add(new SpecificationEntry("Supplier part code", supplierCode));
        }
        if (c.getValue() != null && !c.getValue().isBlank()) {
            specs.add(new SpecificationEntry("Value", c.getValue()));
        }
        if (c.getUnitPrice() != null && c.getUnitPrice().compareTo(BigDecimal.ZERO) > 0) {
            specs.add(new SpecificationEntry("Unit price", c.getUnitPrice().toPlainString()));
        }
        if (c.getItemCode() != null) {
            specs.add(new SpecificationEntry("Moved from component", c.getItemCode()));
        }
        out.setSpecifications(specs);

        long next = itemCodeGenerator.currentEquipmentNumber();
        List<String> codes = new ArrayList<>();
        for (int i = 0; i < units; i++) {
            codes.add(itemCodeGenerator.buildCode(ItemCodeGenerator.EQUIPMENT_PREFIX, ++next));
        }
        out.setEquipmentCodes(codes);
        if (dryRun) {
            return out;
        }

        String movedOn = LocalDate.now().toString();
        for (int i = 0; i < units; i++) {
            String note = joinWith("\n", blankToNull(c.getDescription()),
                    "Moved from component " + (c.getItemCode() != null ? c.getItemCode() : "#" + c.getId())
                            + " on " + movedOn + (units > 1 ? " (unit " + (i + 1) + " of " + units + ")" : "") + ".");
            Equipment eq = equipmentRepository.save(Equipment.builder()
                    .itemCode(codes.get(i))
                    .name(out.getEquipmentName())
                    .category(out.getEquipmentCategory())
                    .manufacturer(blankToNull(out.getManufacturer()))
                    .location(blankToNull(out.getLocation()))
                    .status(out.getStatus())
                    .notes(note)
                    .build());
            out.getEquipmentIds().add(eq.getId());
            specificationService.addMissing(ItemSpecification.EQUIPMENT, eq.getId(), specs);
        }

        // Keep the component (history intact), just archive it, and note where it went.
        String range = codes.size() == 1 ? codes.get(0) : codes.get(0) + " – " + codes.get(codes.size() - 1);
        specificationService.addMissing(ItemSpecification.COMPONENT, c.getId(),
                List.of(new SpecificationEntry("Moved to equipment", range + " on " + movedOn)));
        c.setStatus(ComponentStatus.ARCHIVED);
        componentRepository.save(c);
        return out;
    }

    // ------------------------------------------------------------------ suggestions

    private record Rule(String category, List<String> keywords) { }

    /** Ordered: specific families first. */
    private static final List<Rule> CATEGORY_RULES = List.of(
            new Rule("Programmers & Debuggers", List.of("st-link", "st link", "stlink", "programmer", "debugger",
                    "usbasp", "atmel", "j-link", "jlink", "nu-link", "pickit")),
            new Rule("Solar & Power Management", List.of("solar", "mppt", " bms ", "battery", "lifepo4", "li-ion",
                    "lithium", "charger", "charging")),
            new Rule("Power Modules", List.of("led driver", "dc-dc", "dc dc", " buck", "boost", "step-down",
                    "step down", "step-up", "regulator", "power supply", " smps", "inverter")),
            new Rule("Communication & IoT Modules", List.of("esp32", "esp8266", "wifi", "wi-fi", "bluetooth", " ble ",
                    " gsm", "gprs", " lte", " 4g", "nb-iot", "quectel", "quictel", "sim800", "ethernet", "w5500",
                    "enc28j60", "rs485", "rs-485", "rs232", "can bus", "lora", "zigbee", " rf ", "nrf24", "usb to",
                    "modem")),
            new Rule("Sensor Modules", List.of("sensor", "radar")),
            new Rule("Display Modules", List.of("display", "oled", " lcd", " tft")),
            new Rule("Motor Drivers", List.of("motor driver", "l298", "stepper")));

    static String suggestCategory(String text) {
        String t = norm(text);
        for (Rule r : CATEGORY_RULES) {
            for (String k : r.keywords()) {
                if (t.contains(k)) {
                    return r.category();
                }
            }
        }
        return "General Modules";
    }

    private static final List<String[]> MANUFACTURERS = List.of(
            new String[] { "elejoy", "Elejoy" },
            new String[] { "quectel", "Quectel" },
            new String[] { "quictel", "Quectel" },
            new String[] { "esp32", "Espressif" },
            new String[] { "esp8266", "Espressif" },
            new String[] { "st-link", "STMicroelectronics" },
            new String[] { "st link", "STMicroelectronics" },
            new String[] { "w5500", "WIZnet" },
            new String[] { "atmel", "Microchip (Atmel)" });

    static String suggestManufacturer(String text) {
        String t = norm(text);
        for (String[] m : MANUFACTURERS) {
            if (t.contains(m[0])) {
                return m[1];
            }
        }
        return null;
    }

    // ------------------------------------------------------------------ helpers

    private static String norm(String s) {
        return " " + (s == null ? "" : s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9\\-]+", " ").trim()) + " ";
    }

    private static String joinWith(String sep, String... parts) {
        StringBuilder sb = new StringBuilder();
        for (String p : parts) {
            if (p != null && !p.isBlank()) {
                if (sb.length() > 0) {
                    sb.append(sep);
                }
                sb.append(p.trim());
            }
        }
        return sb.toString();
    }

    private static String firstNonBlank(String a, String b) {
        return a != null && !a.isBlank() ? a.trim() : b;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }

    private static String truncate(String s, int max) {
        return s == null ? null : (s.length() > max ? s.substring(0, max) : s);
    }
}
