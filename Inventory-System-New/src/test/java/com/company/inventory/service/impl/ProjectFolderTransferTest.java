package com.company.inventory.service.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.company.inventory.dto.request.ConfirmInvoiceItemRequest;
import com.company.inventory.dto.request.ConfirmInvoiceRequest;
import com.company.inventory.dto.request.ItemResolution;
import com.company.inventory.dto.request.TransferProjectComponentRequest;
import com.company.inventory.entity.ComponentItem;
import com.company.inventory.entity.Project;
import com.company.inventory.entity.ProjectStock;
import com.company.inventory.entity.Purchase;
import com.company.inventory.exception.InsufficientStockException;
import com.company.inventory.mapper.PurchaseMapper;
import com.company.inventory.repository.ComponentRepository;
import com.company.inventory.repository.EquipmentRepository;
import com.company.inventory.repository.InventoryTransactionRepository;
import com.company.inventory.repository.ProjectComponentUsageRepository;
import com.company.inventory.repository.ProjectRepository;
import com.company.inventory.repository.ProjectStockRepository;
import com.company.inventory.repository.PurchaseItemRepository;
import com.company.inventory.repository.PurchaseRepository;
import com.company.inventory.repository.SupplierRepository;
import com.company.inventory.service.ComponentCategoryService;
import com.company.inventory.service.FileStorageService;
import com.company.inventory.service.InvoiceExtractionService;
import com.company.inventory.service.ItemCodeGenerator;
import com.company.inventory.service.SpecificationService;

/**
 * Units in project folders can be moved: line by line when an invoice is confirmed (scanned
 * in Solar, some lines belong to TMS) and between folders afterwards. Moving never changes
 * the inventory's stock — only which project the units belong to.
 */
class ProjectFolderTransferTest {

    private final Project solar = Project.builder().id(3L).projectName("Solar Street Light Driver").build();
    private final Project tms = Project.builder().id(4L).projectName("Sentrac_TMS").build();
    private final ComponentItem res = ComponentItem.builder().id(10L).componentName("RES 4K7 0603").quantity(500).build();

    private ProjectStockRepository stockRepo;
    private ProjectRepository projectRepo;
    private ComponentRepository componentRepo;
    private ProjectComponentUsageRepository usageRepo;
    private InventoryTransactionRepository transactionRepo;
    private ProjectStockService service;

    @BeforeEach
    void setUp() {
        stockRepo = mock(ProjectStockRepository.class);
        projectRepo = mock(ProjectRepository.class);
        componentRepo = mock(ComponentRepository.class);
        usageRepo = mock(ProjectComponentUsageRepository.class);
        transactionRepo = mock(InventoryTransactionRepository.class);
        when(projectRepo.findById(3L)).thenReturn(Optional.of(solar));
        when(projectRepo.findById(4L)).thenReturn(Optional.of(tms));
        service = new ProjectStockService(stockRepo, projectRepo, componentRepo, usageRepo, transactionRepo,
                mock(PurchaseRepository.class), mock(PurchaseMapper.class));
    }

    private ProjectStock entry(long id, int qty, String price, String source, Long purchaseId, String notes) {
        return ProjectStock.builder().id(id).project(solar).component(res).quantity(qty)
                .unitPrice(new BigDecimal(price)).source(source).purchaseId(purchaseId).notes(notes).build();
    }

    private static TransferProjectComponentRequest move(long componentId, long toProjectId, int qty) {
        TransferProjectComponentRequest r = new TransferProjectComponentRequest();
        r.setComponentId(componentId);
        r.setToProjectId(toProjectId);
        r.setQuantity(qty);
        return r;
    }

    private List<ProjectStock> savedTo(Project p) {
        ArgumentCaptor<ProjectStock> saved = ArgumentCaptor.forClass(ProjectStock.class);
        verify(stockRepo, org.mockito.Mockito.atLeast(0)).save(saved.capture());
        return saved.getAllValues().stream().filter(s -> s.getProject() == p).toList();
    }

    @Test
    void movesNewestUnitsFirstKeepingPriceAndInvoice() {
        ProjectStock older = entry(1, 100, "0.50", ProjectStock.RESERVED, null, null);
        ProjectStock invoice = entry(2, 30, "0.80", ProjectStock.INVOICE, 77L, "Invoice SO289050");
        when(stockRepo.findForProject(3L)).thenReturn(List.of(older, invoice));

        service.transfer(3L, move(10L, 4L, 40), "admin");

        List<ProjectStock> toTms = savedTo(tms);
        assertEquals(2, toTms.size());
        // The invoice entry (newest) moves whole, with its price, origin and invoice link.
        assertEquals(30, toTms.get(0).getQuantity());
        assertEquals(new BigDecimal("0.80"), toTms.get(0).getUnitPrice());
        assertEquals(ProjectStock.INVOICE, toTms.get(0).getSource());
        assertEquals(77L, toTms.get(0).getPurchaseId());
        assertEquals("Moved from Solar Street Light Driver · Invoice SO289050", toTms.get(0).getNotes());
        verify(stockRepo).delete(invoice);
        // The remaining 10 come out of the older entry, which is reduced, not removed.
        assertEquals(10, toTms.get(1).getQuantity());
        assertEquals(new BigDecimal("0.50"), toTms.get(1).getUnitPrice());
        assertEquals(90, older.getQuantity());
        verify(stockRepo, never()).delete(older);
        // Stock is never touched by a move.
        verify(componentRepo, never()).save(any());
        verify(transactionRepo, never()).save(any());
        assertEquals(500, res.getQuantity());
    }

    @Test
    void cannotMoveUnitsAlreadyUsedInTheProject() {
        when(stockRepo.findForProject(3L)).thenReturn(List.of(entry(1, 30, "0.80", ProjectStock.INVOICE, 77L, null)));
        List<Object[]> used = new ArrayList<>();
        used.add(new Object[] {10L, 25L});
        when(usageRepo.usedByComponentForProject(3L)).thenReturn(used);

        InsufficientStockException ex = assertThrows(InsufficientStockException.class,
                () -> service.transfer(3L, move(10L, 4L, 6), "admin"));
        assertTrue(ex.getMessage().contains("Only 5 of RES 4K7 0603 are left"), ex.getMessage());
        verify(stockRepo, never()).save(any());
        verify(stockRepo, never()).delete(any());
    }

    @Test
    void cannotMoveToTheSameProject() {
        assertThrows(IllegalArgumentException.class, () -> service.transfer(3L, move(10L, 3L, 1), "admin"));
        verify(stockRepo, never()).save(any());
    }

    @Test
    void cannotMoveAComponentThatIsNotInTheFolder() {
        when(stockRepo.findForProject(3L)).thenReturn(List.of());
        assertThrows(com.company.inventory.exception.ResourceNotFoundException.class,
                () -> service.transfer(3L, move(10L, 4L, 1), "admin"));
        verify(stockRepo, never()).save(any());
    }

    @Test
    void invoiceLineSentToAnotherFolderSaysWhereItWasScanned() {
        service.addFromInvoice(tms, res, 5, new BigDecimal("0.80"), 77L, "SO289050", solar, "admin");
        service.addFromInvoice(solar, res, 5, new BigDecimal("0.80"), 77L, "SO289050", solar, "admin");

        assertEquals("Invoice SO289050 · scanned in Solar Street Light Driver", savedTo(tms).get(0).getNotes());
        assertEquals("Invoice SO289050", savedTo(solar).get(0).getNotes());
    }

    // ------------------------------------------------------------ invoice confirm routing

    private static ConfirmInvoiceItemRequest line(long componentId, Long projectId, Boolean generalStock) {
        ConfirmInvoiceItemRequest l = new ConfirmInvoiceItemRequest();
        l.setResolution(ItemResolution.EXISTING_COMPONENT);
        l.setComponentId(componentId);
        l.setQuantity(5);
        l.setUnitPrice(new BigDecimal("2.00"));
        l.setProjectId(projectId);
        l.setGeneralStock(generalStock);
        return l;
    }

    @Test
    void eachInvoiceLineGoesToTheFolderChosenForIt() {
        PurchaseRepository purchaseRepo = mock(PurchaseRepository.class);
        ProjectStockService folders = mock(ProjectStockService.class);
        ItemCodeGenerator codes = mock(ItemCodeGenerator.class);
        ComponentItem a = ComponentItem.builder().id(1L).componentName("A").quantity(0).build();
        ComponentItem b = ComponentItem.builder().id(2L).componentName("B").quantity(0).build();
        ComponentItem c = ComponentItem.builder().id(3L).componentName("C").quantity(0).build();
        when(componentRepo.findById(1L)).thenReturn(Optional.of(a));
        when(componentRepo.findById(2L)).thenReturn(Optional.of(b));
        when(componentRepo.findById(3L)).thenReturn(Optional.of(c));
        when(purchaseRepo.save(any(Purchase.class))).thenAnswer(inv -> {
            Purchase p = inv.getArgument(0);
            p.setId(77L);
            return p;
        });
        PurchaseServiceImpl purchases = new PurchaseServiceImpl(purchaseRepo, mock(PurchaseItemRepository.class),
                componentRepo, transactionRepo, mock(SupplierRepository.class), mock(FileStorageService.class),
                mock(PurchaseMapper.class), mock(InvoiceExtractionService.class), mock(EquipmentRepository.class),
                codes, mock(ComponentCategoryService.class), mock(SpecificationService.class), projectRepo, folders);

        ConfirmInvoiceRequest req = new ConfirmInvoiceRequest();
        req.setProjectId(3L); // scanned in Solar
        req.setSupplierName("Robu");
        req.setInvoiceNumber("SO289050");
        req.setItems(List.of(line(1L, null, null), line(2L, 4L, null), line(3L, null, true)));

        purchases.confirmInvoicePurchase(req, "admin");

        // A stays in Solar, B goes to TMS, C stays in general stock only.
        verify(folders).addFromInvoice(eq(solar), eq(a), eq(5), any(), eq(77L), eq("SO289050"), eq(solar), eq("admin"));
        verify(folders).addFromInvoice(eq(tms), eq(b), eq(5), any(), eq(77L), eq("SO289050"), eq(solar), eq("admin"));
        verify(folders, never()).addFromInvoice(any(), eq(c), anyInt(), any(), anyLong(), anyString(), any(), anyString());
        // All three are still received into stock.
        assertEquals(5, a.getQuantity());
        assertEquals(5, b.getQuantity());
        assertEquals(5, c.getQuantity());
    }

    @Test
    void confirmingAnInvoiceAgainSaysWhereItIsAndChangesNothing() {
        PurchaseRepository purchaseRepo = mock(PurchaseRepository.class);
        ProjectStockService folders = mock(ProjectStockService.class);
        Purchase existing = new Purchase();
        existing.setInvoiceNumber("SO289050");
        existing.setProject(solar);
        when(purchaseRepo.findByInvoiceNumber("SO289050")).thenReturn(Optional.of(existing));
        PurchaseServiceImpl purchases = new PurchaseServiceImpl(purchaseRepo, mock(PurchaseItemRepository.class),
                componentRepo, transactionRepo, mock(SupplierRepository.class), mock(FileStorageService.class),
                mock(PurchaseMapper.class), mock(InvoiceExtractionService.class), mock(EquipmentRepository.class),
                mock(ItemCodeGenerator.class), mock(ComponentCategoryService.class), mock(SpecificationService.class),
                projectRepo, folders);

        ConfirmInvoiceRequest req = new ConfirmInvoiceRequest();
        req.setProjectId(4L);
        req.setSupplierName("Robu");
        req.setInvoiceNumber("SO289050");
        req.setItems(List.of(line(1L, null, null)));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> purchases.confirmInvoicePurchase(req, "admin"));
        assertTrue(ex.getMessage().contains("already recorded for project Solar Street Light Driver"), ex.getMessage());
        assertTrue(ex.getMessage().contains("Move to another project"), ex.getMessage());
        verify(purchaseRepo, never()).save(any());
        verify(componentRepo, never()).save(any());
    }
}
