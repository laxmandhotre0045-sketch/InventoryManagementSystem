package com.company.inventory.service.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.company.inventory.dto.response.BomCheckResponse;
import com.company.inventory.dto.response.BomLineResult;
import com.company.inventory.entity.ComponentCategory;
import com.company.inventory.entity.ComponentItem;
import com.company.inventory.entity.ComponentStatus;
import com.company.inventory.repository.ComponentRepository;
import com.company.inventory.repository.EquipmentRepository;
import com.company.inventory.service.BomFileParser;

/**
 * Unit tests for the BOM stock check. The repository is mocked, so these tests never
 * touch a database — and they also assert the service performs nothing but a read.
 */
class BomCheckServiceImplTest {

    private ComponentRepository repo;
    private BomCheckServiceImpl service;

    private static ComponentItem comp(long id, String name, int qty, String category, String value,
                                      ComponentStatus status) {
        return ComponentItem.builder()
                .id(id).componentName(name).quantity(qty).minimumQuantity(0)
                .category(ComponentCategory.builder().id(id).name(category).build())
                .value(value).status(status).itemCode("C" + (10000 + id))
                .build();
    }

    @BeforeEach
    void setUp() {
        repo = mock(ComponentRepository.class);
        when(repo.findAll()).thenReturn(List.of(
                comp(1, "TPS61023DRLR - Texas Instruments - Boost Adjustable DC-DC Converter SOT-563", 50,
                        "DC-DC Converters", null, ComponentStatus.ACTIVE),
                comp(2, "10k Ohm 0.25W Metal Film Resistor", 100, "Passive Components", null, ComponentStatus.ACTIVE),
                comp(3, "100nF 0805 Ceramic Capacitor", 20, "Capacitors", "100nF", ComponentStatus.ACTIVE),
                comp(4, "ESP32-WROOM-32E", 3, "Development Boards", null, ComponentStatus.ACTIVE),
                comp(5, "LM358 Op Amp", 0, "ICs", null, ComponentStatus.ACTIVE),
                comp(6, "4.7k Resistor 0603", 200, "Resistors", "4.7k", ComponentStatus.ACTIVE),
                comp(7, "ATmega328P", 99, "Microcontrollers", null, ComponentStatus.ARCHIVED),
                comp(8, "DHT11 Sensor", 40, "Sensors", null, ComponentStatus.INACTIVE)));
        service = new BomCheckServiceImpl(new BomFileParser(), repo, mock(EquipmentRepository.class));
    }

    private static final String CSV = String.join("\n",
            "Comment,Description,Designator,Footprint,Quantity,Manufacturer Part Number",
            "TPS61023DRLR,Boost converter,U1,SOT-563,1,TPS61023DRLR",
            "10k,Resistor,\"R1, R2, R3\",R_0805,3,",
            "0.1uF,Capacitor,\"C1,C2\",C_0805,2,",
            "ESP32,WiFi module,U2,,5,ESP32-WROOM-32E",
            "LM358,Dual op amp,U3,SOIC-8,2,LM358",
            "4k7,Resistor,R4-R7,R_0805,,",
            "ATmega328P,MCU,U4,TQFP-32,1,ATmega328P",
            "DHT11,Temp sensor,U5,,1,",
            "Unobtainium X9,Mystery part,U6,,4,UNOB-X9",
            "TPS61023DRLR,Boost converter,U7,SOT-563,1,TPS61023DRLR",
            "10k,Pull-up resistor,R10,R_0805,98,",
            "DNP part,Do not populate,R99,R_0805,1,");

    private BomCheckResponse runCsv(int boards) {
        return service.check(CSV.getBytes(StandardCharsets.UTF_8), "board.csv", boards);
    }

    private static BomLineResult line(BomCheckResponse r, String bomLabel) {
        return r.getLines().stream()
                .filter(l -> bomLabel.equals(l.getBomPart()) || bomLabel.equals(l.getBomName()))
                .findFirst().orElseThrow(() -> new AssertionError("no line " + bomLabel));
    }

    @Test
    void classifiesEveryLineCorrectly() {
        BomCheckResponse r = runCsv(1);

        assertEquals(10, r.getTotalLines(), "duplicate TPS line merged, DNP skipped");
        assertEquals(3, r.getAvailableCount());
        assertEquals(2, r.getPartialCount());
        assertEquals(5, r.getToOrderCount());
        assertFalse(r.isReadyToBuild());

        // Part number embedded in a long inventory name; duplicate lines merged (1 + 1).
        BomLineResult tps = line(r, "TPS61023DRLR");
        assertEquals(1L, tps.getComponentId());
        assertEquals("EXACT", tps.getMatchType(), "TPS61023DRLR is a part number of that name");
        assertEquals("HIGH", tps.getConfidence());
        assertEquals(2, tps.getRequiredQuantity());
        assertEquals("AVAILABLE", tps.getStatus());

        // 0.1uF matches the 100nF 0805 capacitor by value.
        BomLineResult cap = line(r, "0.1uF");
        assertEquals(3L, cap.getComponentId());
        assertEquals("VALUE", cap.getMatchType());
        assertEquals("AVAILABLE", cap.getStatus());

        // Exact MPN, but only 3 in stock for 5 needed.
        BomLineResult esp = line(r, "ESP32-WROOM-32E");
        assertEquals("EXACT", esp.getMatchType());
        assertEquals("PARTIAL", esp.getStatus());
        assertEquals(3, esp.getAllocated());
        assertEquals(2, esp.getToOrder());

        // In the catalogue but out of stock.
        BomLineResult lm = line(r, "LM358");
        assertEquals(5L, lm.getComponentId());
        assertEquals("TO_ORDER", lm.getStatus());
        assertEquals(2, lm.getToOrder());

        // 4k7 0805: the only 4.7k resistor is 0603 -> package conflict -> must order.
        // Quantity comes from designators R4-R7 = 4.
        BomLineResult r47 = line(r, "4k7");
        assertNull(r47.getComponentId());
        assertEquals(4, r47.getRequiredQuantity());
        assertEquals("TO_ORDER", r47.getStatus());

        // Archived component is invisible.
        assertNull(line(r, "ATmega328P").getComponentId());

        // Inactive component is matched but contributes no usable stock.
        BomLineResult dht = line(r, "DHT11");
        assertEquals(8L, dht.getComponentId());
        assertTrue(dht.isComponentInactive());
        assertEquals("TO_ORDER", dht.getStatus());

        assertNull(line(r, "UNOB-X9").getComponentId());

        assertTrue(r.getWarnings().stream().anyMatch(w -> w.contains("DNP")));
        assertTrue(r.getWarnings().stream().anyMatch(w -> w.contains("combined")));
        assertEquals("Manufacturer Part Number", r.getDetectedColumns().get("Part number"));
    }

    @Test
    void twoLinesSharingOneComponentShareItsStock() {
        BomCheckResponse r = runCsv(1);
        List<BomLineResult> tenK = r.getLines().stream().filter(l -> "10k".equals(l.getBomName())).toList();
        assertEquals(2, tenK.size());
        assertEquals(2L, tenK.get(0).getComponentId());
        assertEquals(2L, tenK.get(1).getComponentId());
        // 100 in stock: first line takes 3, second needs 98 but only 97 remain.
        assertEquals("AVAILABLE", tenK.get(0).getStatus());
        assertEquals("PARTIAL", tenK.get(1).getStatus());
        assertEquals(97, tenK.get(1).getAllocated());
        assertEquals(1, tenK.get(1).getToOrder());
    }

    @Test
    void boardsMultiplierScalesRequirements() {
        BomCheckResponse r = runCsv(3);
        assertEquals(3, r.getBoards());
        BomLineResult esp = line(r, "ESP32-WROOM-32E");
        assertEquals(15, esp.getRequiredQuantity());
        assertEquals(12, esp.getToOrder());
        assertEquals("AVAILABLE", line(r, "TPS61023DRLR").getStatus()); // 6 of 50
    }

    @Test
    void readsXlsxPicksTheBomSheetAndFindsHeaderBelowATitle() throws Exception {
        byte[] xlsx;
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet notes = wb.createSheet("Notes");
            notes.createRow(0).createCell(0).setCellValue("Read me");
            notes.createRow(1).createCell(0).setCellValue("This is not a BOM");

            Sheet bom = wb.createSheet("BOM");
            bom.createRow(0).createCell(0).setCellValue("Project X - Bill of Materials");
            Row h = bom.createRow(2);
            h.createCell(0).setCellValue("Part Number");
            h.createCell(1).setCellValue("Qty");
            Row a = bom.createRow(3);
            a.createCell(0).setCellValue("TPS61023DRLR");
            a.createCell(1).setCellValue(2);
            Row b = bom.createRow(4);
            b.createCell(0).setCellValue("LM358");
            b.createCell(1).setCellValue(1);
            wb.write(out);
            xlsx = out.toByteArray();
        }

        BomCheckResponse r = service.check(xlsx, "parts.xlsx", 1);
        assertEquals("BOM", r.getSheetName());
        assertEquals(2, r.getTotalLines());
        BomLineResult tps = line(r, "TPS61023DRLR");
        assertEquals(4, tps.getRowNumber(), "row number as Excel shows it");
        assertEquals("AVAILABLE", tps.getStatus());
        assertEquals("TO_ORDER", line(r, "LM358").getStatus());
    }

    @Test
    void semicolonCsvWithoutQuantityColumnUsesDesignatorCount() {
        String csv = "Reference;Value;Footprint\nR1 R2 R3;10k;R_0805\n";
        BomCheckResponse r = service.check(csv.getBytes(StandardCharsets.UTF_8), "kicad.csv", 1);
        BomLineResult l = r.getLines().get(0);
        assertEquals(3, l.getRequiredQuantity());
        assertEquals(2L, l.getComponentId());
        assertEquals("AVAILABLE", l.getStatus());
    }

    @Test
    void rejectsUnsupportedAndUnreadableFiles() {
        assertThrows(IllegalArgumentException.class,
                () -> service.check("x".getBytes(StandardCharsets.UTF_8), "image.png", 1));
        assertThrows(IllegalArgumentException.class,
                () -> service.check("not really excel".getBytes(StandardCharsets.UTF_8), "fake.xlsx", 1));
        assertThrows(IllegalArgumentException.class,
                () -> service.check(new byte[0], "empty.csv", 1));
    }

    @Test
    void onlyReadsTheDatabase() {
        runCsv(1);
        verify(repo).findAll();
        verifyNoMoreInteractions(repo); // no save, delete or update calls
    }

    /** Names exactly as they appear in the real stock-levels export. */
    @Test
    void matchesRealInventoryNamingStyles() {
        ComponentRepository real = mock(ComponentRepository.class);
        when(real.findAll()).thenReturn(List.of(
                comp(101, "RES 10K 0603 1%", 200, "Resistor", null, ComponentStatus.ACTIVE),
                comp(102, "RES 10K", 400, "Resistor", null, ComponentStatus.ACTIVE),
                comp(103, "10k ohm", 10, "Potentiometer", null, ComponentStatus.ACTIVE),
                comp(104, "RES 100 ohm", 100, "Resistor", null, ComponentStatus.ACTIVE),
                comp(105, "RES 100E 0603 1%", 200, "Resistor", null, ComponentStatus.ACTIVE),
                comp(106, "CAP 0.1UF 0805", 300, "Capacitor", null, ComponentStatus.ACTIVE),
                comp(107, "Cap 1 nF", 50, "Capacitor", null, ComponentStatus.ACTIVE),
                comp(108, "CAP 22PF 0805", 100, "Capacitor", null, ComponentStatus.ACTIVE),
                comp(109, "AMS1117-REG LINEAR 3.3V", 30, "IC", null, ComponentStatus.ACTIVE),
                comp(110, "ferrite bead 600E 0603", 10, "Resistor", null, ComponentStatus.ACTIVE),
                comp(111, "16 Mhz", 50, "Crystal Oscillator", null, ComponentStatus.ACTIVE),
                comp(112, "1N4148 100V 200MA THT", 100, "Diode", null, ComponentStatus.ACTIVE),
                comp(113, "RES 220", 100, "Resistor", null, ComponentStatus.ACTIVE),
                comp(114, "ESP32 S3 ETH", 1, "Module", null, ComponentStatus.ACTIVE)));
        BomCheckServiceImpl svc = new BomCheckServiceImpl(new BomFileParser(), real, mock(EquipmentRepository.class));

        String csv = String.join("\n",
                "Designator,Comment,Footprint,Quantity,Manufacturer Part Number",
                "\"R1,R2\",10k,R_0603,2,",
                "R3,100,R_0805,1,",
                "C1,100nF,C_0805,1,",
                "C2,1nF,C_0603,1,",
                "C3,22pF,C_0805,1,",
                "U1,AMS1117-3.3,SOT-223,1,AMS1117-3.3",
                "FB1,600R,0603,1,",
                "Y1,16MHz,HC49,1,",
                "D1,1N4148,SOD-123,1,1N4148",
                "RV1,10k,Pot_Trim,1,",
                "R4,220,R_0805,1,",
                "U2,WiFi module,,1,ESP32-WROOM-32E");
        BomCheckResponse r = svc.check(csv.getBytes(StandardCharsets.UTF_8), "real.csv", 1);
        List<BomLineResult> l = r.getLines();

        assertEquals(101L, l.get(0).getComponentId(), "10k 0603 -> the 0603 resistor, not the 10k pot");
        assertEquals(104L, l.get(1).getComponentId(), "bare 100 on R line -> RES 100 ohm (100E is 0603)");
        assertEquals(106L, l.get(2).getComponentId(), "100nF -> CAP 0.1UF 0805");
        assertEquals(107L, l.get(3).getComponentId(), "1nF -> Cap 1 nF");
        assertEquals(108L, l.get(4).getComponentId(), "22pF -> CAP 22PF 0805");
        assertEquals("VALUE", l.get(4).getMatchType());
        assertEquals(109L, l.get(5).getComponentId(), "AMS1117-3.3 -> AMS1117 family");
        assertEquals("MEDIUM", l.get(5).getConfidence(), "same base part and the 3.3 V version: likely");
        assertEquals(110L, l.get(6).getComponentId(), "600R ferrite -> ferrite bead 600E");
        assertEquals(111L, l.get(7).getComponentId(), "16MHz -> 16 Mhz crystal");
        assertEquals(112L, l.get(8).getComponentId(), "1N4148 is a part number, not a value");
        assertEquals(103L, l.get(9).getComponentId(), "RV 10k -> the potentiometer");
        assertEquals(113L, l.get(10).getComponentId(), "220 -> RES 220");
        assertNull(l.get(11).getComponentId(), "ESP32-WROOM-32E is not an ESP32 S3 ETH");
    }

    @Test
    void parsesElectricalValues() {
        assertEquals(1e-7, BomCheckServiceImpl.siValue("0.1UF", false), 1e-15);
        assertEquals(22e-12, BomCheckServiceImpl.siValue("22PF", false), 1e-18);
        assertEquals(100.0, BomCheckServiceImpl.siValue("100E", true), 1e-9);
        assertEquals(16e6, BomCheckServiceImpl.siValue("16MHz", true), 1e-3);
        assertEquals(100.0, BomCheckServiceImpl.siValue("100 ohm", true), 1e-9);
        assertNull(BomCheckServiceImpl.siValue("1N4148", false), "diode part number is not a value");
        assertNull(BomCheckServiceImpl.siValue("2N7000", false), "transistor part number is not a value");
        assertEquals(4700.0, BomCheckServiceImpl.siValue("4k7", false), 1e-9);
        assertEquals(10000.0, BomCheckServiceImpl.siValue("10kΩ", false), 1e-9);
        assertEquals(1e-7, BomCheckServiceImpl.siValue("0.1uF", false), 1e-15);
        assertEquals(1e-7, BomCheckServiceImpl.siValue("100nF", false), 1e-15);
        assertEquals(2.2, BomCheckServiceImpl.siValue("2R2", false), 1e-9);
        assertEquals(1e6, BomCheckServiceImpl.siValue("1M", false), 1e-6);
        assertNull(BomCheckServiceImpl.siValue("0805", true));
        assertNotNull(BomCheckServiceImpl.siValue("0805", false));
    }
}
