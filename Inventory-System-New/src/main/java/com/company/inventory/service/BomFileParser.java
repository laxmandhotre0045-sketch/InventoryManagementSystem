package com.company.inventory.service;

import java.io.ByteArrayInputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.FormulaEvaluator;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Component;

/**
 * Reads a Bill of Materials from an Excel (.xlsx/.xls) or delimited text (.csv/.tsv/.txt)
 * file into plain rows. Pure parsing — it has no access to the database.
 *
 * <p>BOMs come from many tools (KiCad, Altium, EasyEDA/JLCPCB, hand-made sheets), so
 * nothing about the layout is assumed: the header row is located by scoring the first
 * rows against known column names, the best-scoring sheet is used, and quantities fall
 * back to counting designators when there is no quantity column.</p>
 */
@Component
public class BomFileParser {

    public enum Field { PART, NAME, DESCRIPTION, VALUE, QUANTITY, DESIGNATOR, FOOTPRINT }

    /** One meaningful BOM row. */
    public static final class BomRow {
        public int rowNumber;
        public String part;
        public String name;
        public String description;
        public String value;
        public String footprint;
        public String designators;
        public int quantity;
    }

    /** Everything read from the file. */
    public static final class ParsedBom {
        public String sheetName;
        public final Map<String, String> detectedColumns = new LinkedHashMap<>();
        public final List<String> warnings = new ArrayList<>();
        public final List<BomRow> rows = new ArrayList<>();
    }

    private static final int MAX_ROWS = 5000;
    private static final int MAX_COLS = 60;
    private static final int MAX_SHEETS = 10;
    private static final int HEADER_SCAN_ROWS = 25;

    /** Normalised header text -> field. List order = priority within a field (first wins). */
    private static final Map<Field, List<String>> HEADER_KEYS = new EnumMap<>(Field.class);
    static {
        HEADER_KEYS.put(Field.PART, List.of(
                "mpn", "manufacturerpartnumber", "manufacturerpartno", "manufacturerpart", "mfrpartnumber",
                "mfrpartno", "mfrpart", "mfrpn", "mfgpartnumber", "mfgpart", "partnumber", "partno", "partnum",
                "pn", "libref", "itemcode", "partcode", "sku", "supplierpartnumber", "supplierpart",
                "lcscpartnumber", "lcscpart", "lcsc", "jlcpcbpart", "part"));
        HEADER_KEYS.put(Field.NAME, List.of(
                "comment", "name", "partname", "componentname", "component", "itemname", "item", "material",
                "componentdescription"));
        HEADER_KEYS.put(Field.DESCRIPTION, List.of(
                "description", "desc", "itemdescription", "partdescription", "details", "specification", "specs",
                "spec"));
        HEADER_KEYS.put(Field.VALUE, List.of("value", "val", "rating"));
        HEADER_KEYS.put(Field.QUANTITY, List.of(
                "qty", "quantity", "qtyperboard", "quantityperboard", "qtyper", "qnty", "count", "requiredqty",
                "reqqty", "nos", "units", "pcs"));
        HEADER_KEYS.put(Field.DESIGNATOR, List.of(
                "designator", "designators", "reference", "references", "refdes", "ref", "refs", "partreference",
                "partreferences"));
        HEADER_KEYS.put(Field.FOOTPRINT, List.of(
                "footprint", "package", "packagecase", "case", "pcbfootprint", "size"));
    }

    private static final Map<Field, String> FIELD_LABELS = new EnumMap<>(Field.class);
    static {
        FIELD_LABELS.put(Field.PART, "Part number");
        FIELD_LABELS.put(Field.NAME, "Name");
        FIELD_LABELS.put(Field.DESCRIPTION, "Description");
        FIELD_LABELS.put(Field.VALUE, "Value");
        FIELD_LABELS.put(Field.QUANTITY, "Quantity");
        FIELD_LABELS.put(Field.DESIGNATOR, "Designators");
        FIELD_LABELS.put(Field.FOOTPRINT, "Footprint");
    }

    private static final Pattern DNP = Pattern.compile(
            "(?i)\\b(dnp|dnf|dni|do\\s*not\\s*(populate|place|fit|mount|install)|not\\s*(fitted|populated|mounted)|no\\s*pop)\\b");
    private static final Pattern NUMBER = Pattern.compile("(\\d+(?:[.,]\\d+)?)");
    private static final Pattern DESIGNATOR_RANGE = Pattern.compile("^([A-Za-z_]+)(\\d+)[-–]([A-Za-z_]*)(\\d+)$");

    /** A raw grid row with its 1-based row number in the source file. */
    private record Line(int rowNumber, List<String> cells) { }

    // ------------------------------------------------------------------ entry point

    public ParsedBom parse(byte[] content, String filename) {
        if (content == null || content.length == 0) {
            throw new IllegalArgumentException("The uploaded file is empty.");
        }
        String ext = extension(filename);
        ParsedBom result = new ParsedBom();

        List<Line> grid;
        switch (ext) {
            case "xlsx", "xls", "xlsm" -> grid = readWorkbook(content, result);
            case "csv", "tsv", "txt" -> grid = readDelimited(content);
            default -> throw new IllegalArgumentException(
                    "Unsupported file type. Upload an Excel (.xlsx, .xls) or CSV file.");
        }

        buildRows(grid, result);
        if (result.rows.isEmpty()) {
            throw new IllegalArgumentException(
                    "No components were found in this file. Make sure it has a column such as "
                            + "\"Part Number\", \"MPN\", \"Comment\", \"Name\" or \"Value\".");
        }
        return result;
    }

    // ------------------------------------------------------------------ Excel

    private List<Line> readWorkbook(byte[] content, ParsedBom result) {
        try (Workbook wb = WorkbookFactory.create(new ByteArrayInputStream(content))) {
            DataFormatter fmt = new DataFormatter();
            FormulaEvaluator ev = wb.getCreationHelper().createFormulaEvaluator();

            List<Line> best = null;
            int bestScore = -1;
            String bestName = null;
            int sheets = Math.min(wb.getNumberOfSheets(), MAX_SHEETS);
            for (int s = 0; s < sheets; s++) {
                Sheet sheet = wb.getSheetAt(s);
                List<Line> grid = readSheet(sheet, fmt, ev);
                int score = headerScore(grid);
                if (score > bestScore) {
                    bestScore = score;
                    best = grid;
                    bestName = sheet.getSheetName();
                }
            }
            result.sheetName = bestName;
            if (sheets > 1 && bestName != null) {
                result.warnings.add("The workbook has " + sheets + " sheets; read the BOM from sheet \"" + bestName + "\".");
            }
            return best == null ? List.of() : best;
        } catch (Exception ex) {
            // Includes POI's own IllegalArgumentException subclasses for non-Excel input.
            throw new IllegalArgumentException(
                    "Could not read the Excel file. Make sure it is a valid, non-password-protected .xlsx or .xls file.");
        }
    }

    private List<Line> readSheet(Sheet sheet, DataFormatter fmt, FormulaEvaluator ev) {
        List<Line> grid = new ArrayList<>();
        int last = Math.min(sheet.getLastRowNum(), MAX_ROWS + HEADER_SCAN_ROWS);
        for (int r = sheet.getFirstRowNum(); r <= last; r++) {
            Row row = sheet.getRow(r);
            if (row == null) {
                continue;
            }
            int lastCell = Math.min(Math.max(row.getLastCellNum(), 0), MAX_COLS);
            List<String> cells = new ArrayList<>(lastCell);
            for (int c = 0; c < lastCell; c++) {
                Cell cell = row.getCell(c);
                cells.add(cell == null ? "" : cellText(cell, fmt, ev));
            }
            grid.add(new Line(r + 1, cells));
        }
        return grid;
    }

    private static String cellText(Cell cell, DataFormatter fmt, FormulaEvaluator ev) {
        try {
            return clean(fmt.formatCellValue(cell, ev));
        } catch (Exception ex) {
            try {
                return clean(fmt.formatCellValue(cell));
            } catch (Exception ignored) {
                return "";
            }
        }
    }

    // ------------------------------------------------------------------ CSV / TSV

    private List<Line> readDelimited(byte[] content) {
        String text = decode(content);
        if (!text.isEmpty() && text.charAt(0) == '﻿') {
            text = text.substring(1);
        }
        char delim = detectDelimiter(text);
        List<Line> grid = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder field = new StringBuilder();
        boolean quoted = false;
        int lineNo = 1;
        int rowStart = 1;
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (quoted) {
                if (ch == '"') {
                    if (i + 1 < text.length() && text.charAt(i + 1) == '"') {
                        field.append('"');
                        i++;
                    } else {
                        quoted = false;
                    }
                } else {
                    if (ch == '\n') {
                        lineNo++;
                    }
                    field.append(ch);
                }
            } else if (ch == '"' && field.length() == 0) {
                quoted = true;
            } else if (ch == delim) {
                row.add(clean(field.toString()));
                field.setLength(0);
            } else if (ch == '\n' || ch == '\r') {
                if (ch == '\r' && i + 1 < text.length() && text.charAt(i + 1) == '\n') {
                    i++;
                }
                row.add(clean(field.toString()));
                field.setLength(0);
                grid.add(new Line(rowStart, row));
                row = new ArrayList<>();
                lineNo++;
                rowStart = lineNo;
                if (grid.size() > MAX_ROWS + HEADER_SCAN_ROWS) {
                    break;
                }
            } else {
                field.append(ch);
            }
        }
        if (field.length() > 0 || !row.isEmpty()) {
            row.add(clean(field.toString()));
            grid.add(new Line(rowStart, row));
        }
        return grid;
    }

    /** UTF-8 if valid, otherwise Windows-1252 (what Excel on Windows writes for "CSV"). */
    private static String decode(byte[] content) {
        try {
            return StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(content)).toString();
        } catch (CharacterCodingException ex) {
            return new String(content, Charset.forName("windows-1252"));
        }
    }

    private static char detectDelimiter(String text) {
        String first = "";
        for (String line : text.split("\\r?\\n", 30)) {
            if (!line.isBlank()) {
                first = line;
                break;
            }
        }
        int commas = count(first, ','), semis = count(first, ';'), tabs = count(first, '\t');
        if (tabs > commas && tabs >= semis) {
            return '\t';
        }
        if (semis > commas) {
            return ';';
        }
        return ',';
    }

    private static int count(String s, char c) {
        int n = 0;
        for (int i = 0; i < s.length(); i++) {
            if (s.charAt(i) == c) {
                n++;
            }
        }
        return n;
    }

    // ------------------------------------------------------------------ header + rows

    /** Best header score in the first rows: number of distinct recognised fields. */
    private int headerScore(List<Line> grid) {
        int best = 0;
        for (int i = 0; i < Math.min(grid.size(), HEADER_SCAN_ROWS); i++) {
            Map<Field, Integer> cols = mapHeader(grid.get(i).cells());
            if (isUsableHeader(cols)) {
                best = Math.max(best, cols.size());
            }
        }
        return best;
    }

    private static boolean isUsableHeader(Map<Field, Integer> cols) {
        return cols.containsKey(Field.PART) || cols.containsKey(Field.NAME)
                || cols.containsKey(Field.DESCRIPTION) || cols.containsKey(Field.VALUE);
    }

    /** Field -> column index for one candidate header row. */
    private Map<Field, Integer> mapHeader(List<String> cells) {
        Map<Field, Integer> cols = new EnumMap<>(Field.class);
        Map<Field, Integer> prio = new EnumMap<>(Field.class);
        for (int c = 0; c < cells.size(); c++) {
            String h = normHeader(cells.get(c));
            if (h.isEmpty() || h.length() > 40) {
                continue;
            }
            for (Map.Entry<Field, List<String>> e : HEADER_KEYS.entrySet()) {
                List<String> keys = e.getValue();
                for (int k = 0; k < keys.size(); k++) {
                    String key = keys.get(k);
                    boolean hit = h.equals(key) || (key.length() >= 5 && h.startsWith(key));
                    if (hit) {
                        Integer existing = prio.get(e.getKey());
                        if (existing == null || k < existing) {
                            cols.put(e.getKey(), c);
                            prio.put(e.getKey(), k);
                        }
                        break;
                    }
                }
            }
        }
        // A column may not serve two fields; keep it for the field that claimed it with
        // an exact name, otherwise for the first field in enum order.
        Map<Integer, Field> owner = new LinkedHashMap<>();
        for (Field f : Field.values()) {
            Integer c = cols.get(f);
            if (c == null) {
                continue;
            }
            if (owner.containsKey(c)) {
                cols.remove(f);
            } else {
                owner.put(c, f);
            }
        }
        return cols;
    }

    private void buildRows(List<Line> grid, ParsedBom result) {
        // Locate the header row.
        int headerIdx = -1;
        Map<Field, Integer> cols = null;
        int bestScore = 0;
        for (int i = 0; i < Math.min(grid.size(), HEADER_SCAN_ROWS); i++) {
            Map<Field, Integer> m = mapHeader(grid.get(i).cells());
            if (isUsableHeader(m) && m.size() > bestScore) {
                bestScore = m.size();
                headerIdx = i;
                cols = m;
            }
        }

        if (cols == null) {
            // No recognisable header: first column = part name, a numeric second column = quantity.
            cols = new EnumMap<>(Field.class);
            cols.put(Field.NAME, 0);
            if (looksNumericColumn(grid, 1)) {
                cols.put(Field.QUANTITY, 1);
            }
            result.warnings.add("No header row was recognised; read column 1 as the part name"
                    + (cols.containsKey(Field.QUANTITY) ? " and column 2 as the quantity." : "."));
        } else {
            List<String> header = grid.get(headerIdx).cells();
            for (Field f : Field.values()) {
                Integer c = cols.get(f);
                if (c != null && c < header.size()) {
                    result.detectedColumns.put(FIELD_LABELS.get(f), header.get(c));
                }
            }
        }

        List<String> headerCells = headerIdx >= 0 ? grid.get(headerIdx).cells() : List.of();
        int dnpSkipped = 0;
        int zeroSkipped = 0;
        boolean truncated = false;

        for (int i = headerIdx + 1; i < grid.size(); i++) {
            if (result.rows.size() >= MAX_ROWS) {
                truncated = true;
                break;
            }
            Line line = grid.get(i);
            BomRow row = new BomRow();
            row.rowNumber = line.rowNumber();
            row.part = cell(line, cols.get(Field.PART));
            row.name = cell(line, cols.get(Field.NAME));
            row.description = cell(line, cols.get(Field.DESCRIPTION));
            row.value = cell(line, cols.get(Field.VALUE));
            row.footprint = cell(line, cols.get(Field.FOOTPRINT));
            row.designators = cell(line, cols.get(Field.DESIGNATOR));

            if (blank(row.part) && blank(row.name) && blank(row.description) && blank(row.value)) {
                continue; // empty / spacer row
            }
            if (isRepeatedHeader(line, headerCells)) {
                continue;
            }
            String label = firstNonBlank(row.name, row.description);
            if (blank(row.part) && label != null && label.toLowerCase(Locale.ROOT).matches("^(grand\\s*)?total\\b.*")) {
                continue; // totals row
            }
            if (DNP.matcher(String.join(" ", line.cells())).find()) {
                dnpSkipped++;
                continue;
            }

            Integer explicitQty = parseQuantity(cell(line, cols.get(Field.QUANTITY)));
            if (explicitQty != null && explicitQty == 0) {
                zeroSkipped++;
                continue;
            }
            if (explicitQty != null) {
                row.quantity = explicitQty;
            } else {
                int fromDesignators = countDesignators(row.designators);
                row.quantity = fromDesignators > 0 ? fromDesignators : 1;
            }
            result.rows.add(row);
        }

        if (!cols.containsKey(Field.QUANTITY)) {
            result.warnings.add("No quantity column was found; quantities were taken from the designator count "
                    + "(or 1 per line when there are no designators).");
        }
        if (dnpSkipped > 0) {
            result.warnings.add(dnpSkipped + " line(s) marked DNP / do-not-populate were skipped.");
        }
        if (zeroSkipped > 0) {
            result.warnings.add(zeroSkipped + " line(s) with quantity 0 were skipped.");
        }
        if (truncated) {
            result.warnings.add("Only the first " + MAX_ROWS + " lines were checked.");
        }
    }

    private static boolean isRepeatedHeader(Line line, List<String> headerCells) {
        if (headerCells.isEmpty()) {
            return false;
        }
        int same = 0;
        int nonEmpty = 0;
        for (int c = 0; c < Math.min(line.cells().size(), headerCells.size()); c++) {
            String a = line.cells().get(c);
            if (a.isEmpty()) {
                continue;
            }
            nonEmpty++;
            if (a.equalsIgnoreCase(headerCells.get(c))) {
                same++;
            }
        }
        return nonEmpty > 0 && same == nonEmpty;
    }

    private static boolean looksNumericColumn(List<Line> grid, int col) {
        int numeric = 0;
        int seen = 0;
        for (int i = 0; i < Math.min(grid.size(), 50); i++) {
            String v = cell(grid.get(i), col);
            if (v == null) {
                continue;
            }
            seen++;
            if (v.matches("\\d+(\\.\\d+)?")) {
                numeric++;
            }
        }
        return seen > 0 && numeric * 10 >= seen * 7;
    }

    // ------------------------------------------------------------------ helpers

    /** Quantity from text such as "10", "10.0", "10 pcs", "1,000". Null when there is no number. */
    static Integer parseQuantity(String text) {
        if (blank(text)) {
            return null;
        }
        String t = text.trim();
        if (t.matches("\\d{1,3}(,\\d{3})+")) {
            t = t.replace(",", "");
        }
        Matcher m = NUMBER.matcher(t);
        if (!m.find()) {
            return null;
        }
        double d = Double.parseDouble(m.group(1).replace(',', '.'));
        return (int) Math.ceil(d);
    }

    /** "R1, R2, R5-R8" -> 6. */
    static int countDesignators(String designators) {
        if (blank(designators)) {
            return 0;
        }
        int n = 0;
        for (String tok : designators.split("[,;\\s]+")) {
            if (tok.isBlank() || tok.equals("-") || tok.equals("–")) {
                continue;
            }
            Matcher m = DESIGNATOR_RANGE.matcher(tok);
            if (m.matches()) {
                int a = Integer.parseInt(m.group(2));
                int b = Integer.parseInt(m.group(4));
                if (b >= a && b - a < 1000) {
                    n += b - a + 1;
                    continue;
                }
            }
            n++;
        }
        return n;
    }

    private static String cell(Line line, Integer col) {
        if (col == null || col < 0 || col >= line.cells().size()) {
            return null;
        }
        String v = line.cells().get(col);
        return blank(v) ? null : v;
    }

    private static String normHeader(String s) {
        return s == null ? "" : s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    private static String clean(String s) {
        return s == null ? "" : s.replace(' ', ' ').replaceAll("\\s+", " ").trim();
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (!blank(v)) {
                return v;
            }
        }
        return null;
    }

    private static String extension(String filename) {
        if (filename == null) {
            return "";
        }
        int dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}
