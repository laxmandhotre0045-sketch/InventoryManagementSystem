package com.company.inventory.service.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;

import com.company.inventory.dto.response.PurchaseBinEntry;
import com.company.inventory.dto.response.PurchaseDeletePreview;
import com.company.inventory.entity.AuditLog;
import com.company.inventory.entity.ComponentItem;
import com.company.inventory.entity.ComponentStatus;
import com.company.inventory.entity.Equipment;
import com.company.inventory.entity.InventoryTransaction;
import com.company.inventory.entity.Project;
import com.company.inventory.entity.ProjectStock;
import com.company.inventory.entity.Purchase;
import com.company.inventory.entity.PurchaseItem;
import com.company.inventory.entity.TransactionType;
import com.company.inventory.repository.AuditLogRepository;
import com.company.inventory.repository.ComponentRepository;
import com.company.inventory.repository.EquipmentRepository;
import com.company.inventory.repository.InventoryTransactionRepository;
import com.company.inventory.repository.ProjectRepository;
import com.company.inventory.repository.ProjectStockRepository;
import com.company.inventory.repository.PurchaseItemRepository;
import com.company.inventory.repository.PurchaseRepository;
import com.company.inventory.repository.SupplierRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;

/**
 * Deleting a purchase puts it in a bin for 7 days. Optionally the stock the invoice added
 * is taken back out; restoring undoes exactly what the deletion did.
 */
class PurchaseBinServiceTest {

    /** Records the SQL a restore runs instead of touching a database. */
    static class RecordingJdbc extends JdbcTemplate {
        final List<String> sql = new ArrayList<>();
        final List<Object[]> args = new ArrayList<>();

        @Override
        public int update(String s, Object... a) {
            sql.add(s);
            args.add(a);
            return 1;
        }
    }

    private final LocalDateTime created = LocalDateTime.of(2026, 10, 28, 7, 16);
    private final Project solar = Project.builder().id(3L).projectName("Solar Street Light Driver").build();
    private ComponentItem oldRes;   // in stock before the invoice, bought elsewhere too
    private ComponentItem newModule; // created by this invoice
    private ComponentItem usedCap;  // older part, most units already used
    private Purchase purchase;

    private PurchaseRepository purchaseRepo;
    private PurchaseItemRepository itemRepo;
    private ComponentRepository componentRepo;
    private InventoryTransactionRepository txRepo;
    private EquipmentRepository equipmentRepo;
    private ProjectStockRepository stockRepo;
    private ProjectRepository projectRepo;
    private AuditLogRepository auditRepo;
    private RecordingJdbc jdbc;
    private PurchaseBinService service;
    private final List<AuditLog> logs = new ArrayList<>();

    @BeforeEach
    void setUp() {
        oldRes = ComponentItem.builder().id(18L).componentName("RES 220E 0603").quantity(2200)
                .status(ComponentStatus.ACTIVE).createdAt(created.minusDays(30)).build();
        newModule = ComponentItem.builder().id(500L).componentName("HLK-5M05 POWER MODULE").quantity(20)
                .status(ComponentStatus.ACTIVE).createdAt(created.minusSeconds(2)).build();
        usedCap = ComponentItem.builder().id(501L).componentName("Cap 470/35").quantity(30)
                .status(ComponentStatus.ACTIVE).createdAt(created.minusDays(10)).build();
        purchase = new Purchase();
        purchase.setId(10L);
        purchase.setInvoiceNumber("SO289050");
        purchase.setSupplierName("MACFOS LIMITED");
        purchase.setTotalAmount(new BigDecimal("20100.03"));
        purchase.setPurchaseDate(LocalDate.of(2026, 10, 16));
        purchase.setInvoiceFilePath("uploads/invoices/23904d34.pdf");
        purchase.setProject(solar);
        purchase.setCreatedAt(created);
        purchase.setCreatedBy("admin");
        purchase.setItems(new ArrayList<>(List.of(
                item(25L, oldRes, 2000, "0.26"), item(26L, newModule, 20, "240.00"), item(27L, usedCap, 100, "4.00"))));

        purchaseRepo = mock(PurchaseRepository.class);
        itemRepo = mock(PurchaseItemRepository.class);
        componentRepo = mock(ComponentRepository.class);
        txRepo = mock(InventoryTransactionRepository.class);
        equipmentRepo = mock(EquipmentRepository.class);
        stockRepo = mock(ProjectStockRepository.class);
        projectRepo = mock(ProjectRepository.class);
        auditRepo = mock(AuditLogRepository.class);
        jdbc = new RecordingJdbc();

        when(purchaseRepo.findById(10L)).thenReturn(Optional.of(purchase));
        when(itemRepo.countByComponentIdAndPurchaseIdNot(18L, 10L)).thenReturn(3L);
        when(componentRepo.findById(18L)).thenReturn(Optional.of(oldRes));
        when(componentRepo.findById(500L)).thenReturn(Optional.of(newModule));
        when(componentRepo.findById(501L)).thenReturn(Optional.of(usedCap));
        when(componentRepo.existsById(any())).thenReturn(true);
        when(projectRepo.existsById(3L)).thenReturn(true);
        when(stockRepo.findByPurchaseId(10L)).thenReturn(List.of(ProjectStock.builder().id(31L).project(solar)
                .component(oldRes).quantity(2000).unitPrice(new BigDecimal("0.26")).source(ProjectStock.INVOICE)
                .purchaseId(10L).notes("Invoice SO289050").createdAt(created).build()));
        Equipment tweezers = new Equipment();
        tweezers.setId(20L);
        tweezers.setPurchaseId(10L);
        when(equipmentRepo.findByPurchaseIdOrderByIdAsc(10L)).thenReturn(List.of(tweezers));
        when(equipmentRepo.findById(20L)).thenReturn(Optional.of(tweezers));
        when(auditRepo.save(any(AuditLog.class))).thenAnswer(inv -> {
            AuditLog l = inv.getArgument(0);
            if (l.getId() == null) {
                l.setId(900L + logs.size());
                logs.add(l);
            }
            return l;
        });
        when(auditRepo.findByActionOrderByTimestampDesc(PurchaseBinService.IN_BIN)).thenAnswer(inv ->
                logs.stream().filter(l -> PurchaseBinService.IN_BIN.equals(l.getAction())).toList());
        when(auditRepo.findById(any())).thenAnswer(inv ->
                logs.stream().filter(l -> l.getId().equals(inv.getArgument(0))).findFirst());

        ObjectMapper mapper = new ObjectMapper().findAndRegisterModules()
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        service = new PurchaseBinService(purchaseRepo, itemRepo, componentRepo, txRepo, equipmentRepo, stockRepo,
                projectRepo, mock(SupplierRepository.class), auditRepo, jdbc, mapper);
    }

    private PurchaseItem item(long id, ComponentItem c, int qty, String price) {
        BigDecimal p = new BigDecimal(price);
        return PurchaseItem.builder().id(id).purchase(purchase).component(c).quantity(qty).unitPrice(p)
                .totalPrice(p.multiply(BigDecimal.valueOf(qty))).build();
    }

    @Test
    void previewShowsWhatWouldBeRemovedAndChangesNothing() {
        PurchaseDeletePreview p = service.preview(10L);

        assertEquals(3, p.getLines().size());
        PurchaseDeletePreview.Line res = p.getLines().get(0);
        assertEquals(2000, res.getRemove());
        assertEquals(200, res.getStockAfter());
        assertFalse(res.isArchive());
        assertTrue(p.getLines().get(1).isArchive()); // module exists only because of this invoice
        assertEquals(30, p.getLines().get(2).getRemove()); // only 30 of 100 left — never below zero
        assertEquals(1, p.getFolderEntries());
        assertEquals(1, p.getEquipmentCount());
        assertEquals(2200, oldRes.getQuantity());
        verify(componentRepo, never()).save(any());
    }

    @Test
    void deleteKeepsStockUnlessAskedAndCanBeRestored() {
        PurchaseBinEntry e = service.moveToBin(10L, false, "admin");

        verify(purchaseRepo).delete(purchase);
        assertEquals(2200, oldRes.getQuantity());
        verify(stockRepo, never()).delete(any());
        verify(txRepo, never()).save(any());
        assertFalse(e.isComponentsRemoved());
        assertEquals(7, e.getDaysLeft());
        assertEquals(PurchaseBinService.IN_BIN, logs.get(0).getAction());

        // restore: the same purchase id and lines come back, equipment is linked again
        when(purchaseRepo.findByInvoiceNumber("SO289050")).thenReturn(Optional.empty());
        service.restore(e.getId(), "admin");
        assertTrue(jdbc.sql.get(0).startsWith("insert into purchases"));
        assertEquals(10L, jdbc.args.get(0)[0]);
        assertEquals("SO289050", jdbc.args.get(0)[6]);
        assertEquals(created, jdbc.args.get(0)[1]);
        assertEquals(3L, jdbc.args.get(0)[16]); // project kept
        assertEquals(4, jdbc.sql.size()); // purchase + 3 lines, no folder entries (they were never removed)
        assertEquals(25L, jdbc.args.get(1)[0]);
        assertEquals(10L, equipmentRepoLink());
        assertEquals(PurchaseBinService.RESTORED, logs.get(0).getAction());
        assertEquals(2200, oldRes.getQuantity());
    }

    private Long equipmentRepoLink() {
        return equipmentRepo.findById(20L).orElseThrow().getPurchaseId();
    }

    @Test
    void deleteWithComponentsTakesStockOutAndRestorePutsItBack() {
        PurchaseBinEntry e = service.moveToBin(10L, true, "admin");

        assertEquals(200, oldRes.getQuantity());
        assertEquals(0, newModule.getQuantity());
        assertEquals(ComponentStatus.ARCHIVED, newModule.getStatus());
        assertEquals(0, usedCap.getQuantity());
        assertEquals(ComponentStatus.ACTIVE, usedCap.getStatus()); // older part: emptied, never archived
        assertEquals(2050, e.getUnitsRemoved());
        ArgumentCaptor<InventoryTransaction> tx = ArgumentCaptor.forClass(InventoryTransaction.class);
        verify(txRepo, org.mockito.Mockito.times(3)).save(tx.capture());
        assertTrue(tx.getAllValues().stream().allMatch(t -> t.getTransactionType() == TransactionType.STOCK_OUT));
        verify(stockRepo).delete(any(ProjectStock.class));
        assertNull(equipmentRepoLink());

        when(purchaseRepo.findByInvoiceNumber("SO289050")).thenReturn(Optional.empty());
        service.restore(e.getId(), "admin");
        assertEquals(2200, oldRes.getQuantity());
        assertEquals(20, newModule.getQuantity());
        assertEquals(ComponentStatus.ACTIVE, newModule.getStatus());
        assertEquals(30, usedCap.getQuantity());
        assertTrue(jdbc.sql.get(jdbc.sql.size() - 1).startsWith("insert into project_stock"));
        assertEquals(31L, jdbc.args.get(jdbc.args.size() - 1)[0]);
        assertEquals("Invoice SO289050", jdbc.args.get(jdbc.args.size() - 1)[3]);
        assertEquals(10L, equipmentRepoLink());
    }

    @Test
    void restoreRefusesWhenTheInvoiceWasRecordedAgain() {
        PurchaseBinEntry e = service.moveToBin(10L, false, "admin");
        when(purchaseRepo.findByInvoiceNumber("SO289050")).thenReturn(Optional.of(new Purchase()));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.restore(e.getId(), "admin"));
        assertTrue(ex.getMessage().contains("recorded again"), ex.getMessage());
        assertTrue(jdbc.sql.isEmpty());
        assertEquals(PurchaseBinService.IN_BIN, logs.get(0).getAction());
    }

    @Test
    void afterSevenDaysItLeavesTheBinAndCannotBeRestored() {
        PurchaseBinEntry e = service.moveToBin(10L, false, "admin");
        logs.get(0).setTimestamp(LocalDateTime.now().minusDays(8));

        assertTrue(service.list().isEmpty());
        assertEquals(PurchaseBinService.EXPIRED, logs.get(0).getAction());
        assertTrue(logs.get(0).getDescription().startsWith("Invoice SO289050 from MACFOS LIMITED"));
        assertThrows(IllegalArgumentException.class, () -> service.restore(e.getId(), "admin"));
        assertTrue(jdbc.sql.isEmpty());
    }

    @Test
    void listShowsWhatIsInTheBin() {
        service.moveToBin(10L, true, "admin");
        List<PurchaseBinEntry> bin = service.list();
        assertEquals(1, bin.size());
        assertEquals("SO289050", bin.get(0).getInvoiceNumber());
        assertEquals("Solar Street Light Driver", bin.get(0).getProjectName());
        assertEquals(3, bin.get(0).getItemCount());
        assertTrue(bin.get(0).isComponentsRemoved());
    }
}
