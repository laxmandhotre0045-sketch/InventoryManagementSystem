package com.company.inventory.service.impl;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.company.inventory.dto.response.BomCheckResponse;
import com.company.inventory.dto.response.BomLineResult;
import com.company.inventory.entity.ComponentItem;
import com.company.inventory.entity.ComponentStatus;
import com.company.inventory.entity.Equipment;
import com.company.inventory.repository.ComponentRepository;
import com.company.inventory.repository.EquipmentRepository;
import com.company.inventory.service.BomCheckService;
import com.company.inventory.service.BomFileParser;
import com.company.inventory.service.BomFileParser.BomRow;
import com.company.inventory.service.BomFileParser.ParsedBom;
import com.company.inventory.service.ElectronicsText;

/**
 * Matches BOM lines to inventory components and works out what is in stock and what
 * has to be ordered. The matching itself lives in {@link BomMatcher}.
 *
 * <p><b>Read-only by design.</b> The only database access is reading the component table
 * (and, for parts not found, the equipment table) inside a read-only transaction; nothing
 * is saved, so checking a BOM can never change or lose inventory data.</p>
 *
 * <p>A LOW-confidence match is reported with status {@code VERIFY}: it is shown with the
 * stock it would use, but it is not counted as in stock and the BOM is not "ready to build"
 * until someone confirms it. Stock shared by several lines goes to the most certain
 * matches first.</p>
 */
@Service
public class BomCheckServiceImpl implements BomCheckService {

    private static final int MAX_BOARDS = 100_000;

    private final BomFileParser parser;
    private final ComponentRepository componentRepository;
    private final EquipmentRepository equipmentRepository;

    public BomCheckServiceImpl(BomFileParser parser, ComponentRepository componentRepository,
                               EquipmentRepository equipmentRepository) {
        this.parser = parser;
        this.componentRepository = componentRepository;
        this.equipmentRepository = equipmentRepository;
    }

    // ------------------------------------------------------------------ entry point

    @Override
    @Transactional(readOnly = true)
    public BomCheckResponse check(byte[] content, String filename, int boards) {
        int b = Math.max(1, Math.min(boards, MAX_BOARDS));
        ParsedBom parsed = parser.parse(content, filename);

        BomCheckResponse resp = new BomCheckResponse();
        resp.setFileName(filename);
        resp.setSheetName(parsed.sheetName);
        resp.setBoards(b);
        resp.getDetectedColumns().putAll(parsed.detectedColumns);
        resp.getWarnings().addAll(parsed.warnings);

        List<BomRow> rows = mergeDuplicates(parsed.rows, resp.getWarnings());

        List<BomMatcher.Indexed> inventory = new ArrayList<>();
        for (ComponentItem c : componentRepository.findAll()) {
            if (c.getStatus() != ComponentStatus.ARCHIVED) {
                inventory.add(new BomMatcher.Indexed(c));
            }
        }

        List<BomLineResult> lines = new ArrayList<>();
        List<BomMatcher.Match> matches = new ArrayList<>();
        for (BomRow row : rows) {
            BomMatcher.Line prepared = new BomMatcher.Line(row);
            BomMatcher.Result result = BomMatcher.match(prepared, inventory);
            lines.add(describe(row, b, result));
            matches.add(result.best());
        }

        allocate(lines, matches);
        noteEquipment(lines, rows);

        int available = 0, partial = 0, toOrder = 0, verify = 0, possible = 0;
        for (BomLineResult l : lines) {
            switch (l.getStatus()) {
                case "AVAILABLE" -> available++;
                case "PARTIAL" -> partial++;
                case "VERIFY" -> verify++;
                default -> toOrder++;
            }
            if ("LOW".equals(l.getConfidence())) {
                possible++;
            }
        }
        resp.getLines().addAll(lines);
        resp.setTotalLines(lines.size());
        resp.setAvailableCount(available);
        resp.setPartialCount(partial);
        resp.setToOrderCount(toOrder);
        resp.setVerifyCount(verify);
        resp.setPossibleMatchCount(possible);
        resp.setReadyToBuild(!lines.isEmpty() && partial == 0 && toOrder == 0 && verify == 0);
        return resp;
    }

    /** The BOM side of a line plus the matched component (stock allocation comes later). */
    private static BomLineResult describe(BomRow row, int boards, BomMatcher.Result result) {
        BomLineResult line = new BomLineResult();
        line.setRowNumber(row.rowNumber);
        line.setBomPart(row.part);
        line.setBomName(BomMatcher.firstNonBlank(row.name, row.description));
        line.setBomValue(row.value);
        line.setBomFootprint(row.footprint);
        line.setDesignators(row.designators);
        line.setQuantityPerBoard(row.quantity);
        line.setRequiredQuantity((int) Math.min((long) row.quantity * boards, Integer.MAX_VALUE));

        BomMatcher.Match m = result.best();
        if (m == null) {
            line.setMatchType("NONE");
            return line;
        }
        ComponentItem c = m.target().c;
        line.setMatchType(m.type());
        line.setConfidence(m.confidence());
        line.setNote(m.note());
        line.setComponentId(c.getId());
        line.setComponentName(c.getComponentName());
        line.setItemCode(c.getItemCode());
        line.setCategory(c.getCategory() != null ? c.getCategory().getName() : null);
        line.setType(c.getType());
        line.setValue(c.getValue());
        boolean inactive = c.getStatus() == ComponentStatus.INACTIVE;
        line.setInStock(usable(c));
        line.setComponentInactive(inactive);
        line.setRackNo(c.getRackNo());
        line.setLocation(c.getLocation());
        line.setUnitPrice(c.getUnitPrice());
        for (BomMatcher.Match alt : result.alternatives()) {
            ComponentItem a = alt.target().c;
            line.getAlternatives().add(new BomLineResult.Alternative(
                    a.getId(), a.getComponentName(), usable(a), alt.confidence()));
        }
        return line;
    }

    private static int usable(ComponentItem c) {
        boolean inactive = c.getStatus() == ComponentStatus.INACTIVE;
        return inactive || c.getQuantity() == null ? 0 : Math.max(c.getQuantity(), 0);
    }

    /**
     * Stock is shared: lines resolving to the same component draw from one pool. Certain
     * matches draw first, so a loose "verify" guess never takes stock a confirmed line needs.
     */
    private static void allocate(List<BomLineResult> lines, List<BomMatcher.Match> matches) {
        List<Integer> order = new ArrayList<>();
        for (int i = 0; i < lines.size(); i++) {
            order.add(i);
        }
        order.sort(Comparator.comparingInt(i -> rank(lines.get(i).getConfidence())));

        Map<Long, Integer> remaining = new HashMap<>();
        for (int i : order) {
            BomLineResult line = lines.get(i);
            int required = line.getRequiredQuantity();
            if (matches.get(i) == null) {
                line.setStatus("TO_ORDER");
                line.setAllocated(0);
                line.setToOrder(required);
                continue;
            }
            int left = remaining.computeIfAbsent(line.getComponentId(), id -> line.getInStock());
            int allocated = Math.min(required, left);
            remaining.put(line.getComponentId(), left - allocated);
            line.setAllocated(allocated);
            line.setToOrder(required - allocated);
            if ("LOW".equals(line.getConfidence())) {
                line.setStatus("VERIFY");
            } else if (allocated >= required) {
                line.setStatus("AVAILABLE");
            } else if (allocated > 0) {
                line.setStatus("PARTIAL");
            } else {
                line.setStatus("TO_ORDER");
            }
        }
    }

    private static int rank(String confidence) {
        if (confidence == null) {
            return 3;
        }
        return switch (confidence) {
            case "HIGH" -> 0;
            case "MEDIUM" -> 1;
            default -> 2;
        };
    }

    /**
     * Modules moved to the Equipment register are no longer components. When a missing or
     * uncertain line names one, say where it is instead of leaving "order it" unexplained.
     */
    private void noteEquipment(List<BomLineResult> lines, List<BomRow> rows) {
        List<Equipment> equipment = null;
        for (int i = 0; i < lines.size(); i++) {
            BomLineResult line = lines.get(i);
            if (line.getComponentId() != null && !"LOW".equals(line.getConfidence())) {
                continue;
            }
            if (equipment == null) {
                equipment = equipmentRepository.findAll();
                if (equipment.isEmpty()) {
                    return;
                }
            }
            BomRow row = rows.get(i);
            Map<String, List<String>> hits = new LinkedHashMap<>();
            for (BomMatcher.Part p : BomMatcher.parts(BomMatcher.join(row.part, row.name, row.value), false)) {
                if (p.key.length() < 4) {
                    continue;
                }
                for (Equipment e : equipment) {
                    if (e.getName() != null && BomMatcher.key(e.getName()).contains(p.key)) {
                        hits.computeIfAbsent(e.getName(), n -> new ArrayList<>()).add(e.getItemCode());
                    }
                }
                if (!hits.isEmpty()) {
                    break;
                }
            }
            if (!hits.isEmpty()) {
                Map.Entry<String, List<String>> first = hits.entrySet().iterator().next();
                List<String> codes = first.getValue();
                String where = "In Equipment, not component stock: " + first.getKey() + " ("
                        + codes.size() + " unit" + (codes.size() == 1 ? "" : "s") + ", "
                        + (codes.size() == 1 ? codes.get(0) : codes.get(0) + " – " + codes.get(codes.size() - 1)) + ")";
                line.setNote(line.getNote() == null ? where : line.getNote() + "; " + where);
            }
        }
    }

    // ------------------------------------------------------------------ BOM preparation

    /** Same part listed on several lines -> one line with the quantities summed. */
    private List<BomRow> mergeDuplicates(List<BomRow> rows, List<String> warnings) {
        Map<String, BomRow> merged = new LinkedHashMap<>();
        int duplicates = 0;
        for (BomRow r : rows) {
            String pk = BomMatcher.key(r.part);
            String k = !pk.isEmpty()
                    ? "p:" + pk
                    : "n:" + BomMatcher.key(r.name) + "|" + BomMatcher.key(r.value) + "|"
                            + BomMatcher.key(r.footprint) + "|" + BomMatcher.key(r.description);
            BomRow existing = merged.get(k);
            if (existing == null) {
                merged.put(k, r);
            } else {
                duplicates++;
                existing.quantity += r.quantity;
                if (!BomMatcher.blank(r.designators)) {
                    existing.designators = BomMatcher.blank(existing.designators)
                            ? r.designators : existing.designators + ", " + r.designators;
                }
            }
        }
        if (duplicates > 0) {
            warnings.add(duplicates + " duplicate line(s) for the same part were combined and their quantities added.");
        }
        return new ArrayList<>(merged.values());
    }

    // ------------------------------------------------------------------ values

    /** Kept for callers and tests: value parsing lives in ElectronicsText. */
    static Double siValue(String text, boolean strict) {
        return ElectronicsText.siValue(text, strict);
    }
}
