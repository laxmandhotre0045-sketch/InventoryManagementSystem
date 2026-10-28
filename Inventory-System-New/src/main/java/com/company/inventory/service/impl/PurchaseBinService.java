package com.company.inventory.service.impl;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.company.inventory.dto.response.PurchaseBinEntry;
import com.company.inventory.dto.response.PurchaseDeletePreview;
import com.company.inventory.entity.AuditLog;
import com.company.inventory.entity.ComponentItem;
import com.company.inventory.entity.ComponentStatus;
import com.company.inventory.entity.Equipment;
import com.company.inventory.entity.InventoryTransaction;
import com.company.inventory.entity.ProjectStock;
import com.company.inventory.entity.Purchase;
import com.company.inventory.entity.PurchaseItem;
import com.company.inventory.entity.TransactionType;
import com.company.inventory.exception.ResourceNotFoundException;
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

/**
 * Deleting a purchase moves it to a bin for {@value #KEEP_DAYS} days instead of losing it.
 *
 * <p>The bin needs no table of its own: each deletion is written to the audit log
 * (action {@value #IN_BIN}) together with a compressed copy of everything the deletion
 * removed — the purchase, its lines, the equipment it was linked to and, when the
 * operator chose to remove the invoice's components too, the stock taken out, the
 * components archived and the project-folder entries removed. Restoring puts every one
 * of those back exactly, with the purchase's original id, so invoice scans and folder
 * entries that point at it link up again.</p>
 *
 * <p>Removing components never deletes a component record: its stock is reduced by what
 * the invoice added (never below zero), and a component that exists only because of
 * this invoice is archived, which the Components page can also undo.</p>
 */
@Service
@Transactional
public class PurchaseBinService {

    static final String IN_BIN = "PURCHASE_BIN";
    static final String RESTORED = "PURCHASE_BIN_RESTORED";
    static final String EXPIRED = "PURCHASE_BIN_EXPIRED";
    static final int KEEP_DAYS = 7;

    /** The audit log's description column is TEXT (64 KB). */
    private static final int TEXT_MAX = 65_000;
    private static final String PREFIX = "gz1:";

    private final PurchaseRepository purchaseRepository;
    private final PurchaseItemRepository itemRepository;
    private final ComponentRepository componentRepository;
    private final InventoryTransactionRepository transactionRepository;
    private final EquipmentRepository equipmentRepository;
    private final ProjectStockRepository stockRepository;
    private final ProjectRepository projectRepository;
    private final SupplierRepository supplierRepository;
    private final AuditLogRepository auditRepository;
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public PurchaseBinService(PurchaseRepository purchaseRepository, PurchaseItemRepository itemRepository,
                              ComponentRepository componentRepository, InventoryTransactionRepository transactionRepository,
                              EquipmentRepository equipmentRepository, ProjectStockRepository stockRepository,
                              ProjectRepository projectRepository, SupplierRepository supplierRepository,
                              AuditLogRepository auditRepository, JdbcTemplate jdbc, ObjectMapper json) {
        this.purchaseRepository = purchaseRepository;
        this.itemRepository = itemRepository;
        this.componentRepository = componentRepository;
        this.transactionRepository = transactionRepository;
        this.equipmentRepository = equipmentRepository;
        this.stockRepository = stockRepository;
        this.projectRepository = projectRepository;
        this.supplierRepository = supplierRepository;
        this.auditRepository = auditRepository;
        this.jdbc = jdbc;
        this.json = json;
    }

    // ------------------------------------------------------------------ delete

    /** What deleting the purchase would do, for the confirmation dialog. Changes nothing. */
    @Transactional(readOnly = true)
    public PurchaseDeletePreview preview(Long purchaseId) {
        Purchase p = require(purchaseId);
        PurchaseDeletePreview out = new PurchaseDeletePreview();
        out.setPurchaseId(p.getId());
        out.setInvoiceNumber(p.getInvoiceNumber());
        out.setSupplierName(p.getSupplierName());
        out.setTotalAmount(p.getTotalAmount());
        out.setProjectName(p.getProject() != null ? p.getProject().getProjectName() : null);
        out.setFolderEntries(stockRepository.findByPurchaseId(purchaseId).size());
        out.setEquipmentCount(equipmentRepository.findByPurchaseIdOrderByIdAsc(purchaseId).size());
        for (Removal r : removals(p)) {
            PurchaseDeletePreview.Line line = new PurchaseDeletePreview.Line();
            line.setComponentId(r.component.getId());
            line.setComponentName(r.component.getComponentName());
            line.setInvoiceQuantity(r.invoiceQty);
            line.setInStock(nz(r.component.getQuantity()));
            line.setRemove(r.remove);
            line.setStockAfter(nz(r.component.getQuantity()) - r.remove);
            line.setArchive(r.archive);
            out.getLines().add(line);
        }
        return out;
    }

    /**
     * Deletes the purchase into the bin. With {@code removeComponents} the stock this
     * invoice added is taken back out of the inventory as well.
     */
    public PurchaseBinEntry moveToBin(Long purchaseId, boolean removeComponents, String username) {
        expireOld();
        Purchase p = require(purchaseId);
        Snapshot s = new Snapshot();
        s.purchase = PurchaseData.of(p);
        for (PurchaseItem it : p.getItems()) {
            s.items.add(ItemData.of(it));
        }
        s.componentsRemoved = removeComponents;

        if (removeComponents) {
            for (Removal r : removals(p)) {
                ComponentItem c = r.component;
                StockData d = new StockData();
                d.componentId = c.getId();
                d.componentName = c.getComponentName();
                d.quantity = r.remove;
                d.archived = r.archive;
                d.previousStatus = c.getStatus() != null ? c.getStatus().name() : ComponentStatus.ACTIVE.name();
                if (r.remove > 0) {
                    c.setQuantity(nz(c.getQuantity()) - r.remove);
                    transactionRepository.save(InventoryTransaction.builder()
                            .component(c)
                            .transactionType(TransactionType.STOCK_OUT)
                            .quantity(r.remove)
                            .remarks("Invoice deleted: " + p.getInvoiceNumber())
                            .createdBy(username)
                            .build());
                }
                if (r.archive) {
                    c.setStatus(ComponentStatus.ARCHIVED);
                }
                componentRepository.save(c);
                s.stock.add(d);
            }
            for (ProjectStock e : stockRepository.findByPurchaseId(purchaseId)) {
                s.folderEntries.add(FolderData.of(e));
                stockRepository.delete(e);
            }
        }
        // The equipment itself stays — only its link to the deleted purchase is cleared.
        for (Equipment eq : equipmentRepository.findByPurchaseIdOrderByIdAsc(purchaseId)) {
            s.equipmentIds.add(eq.getId());
            eq.setPurchaseId(null);
            equipmentRepository.save(eq);
        }

        AuditLog log = auditRepository.save(AuditLog.builder()
                .user(username)
                .action(IN_BIN)
                .entityType("PURCHASE")
                .entityId(purchaseId)
                .timestamp(LocalDateTime.now())
                .description(encode(s))
                .build());
        purchaseRepository.delete(p);
        return toEntry(log, s);
    }

    // ------------------------------------------------------------------ bin

    /** Purchases deleted in the last {@value #KEEP_DAYS} days, newest first. */
    public List<PurchaseBinEntry> list() {
        expireOld();
        List<PurchaseBinEntry> out = new ArrayList<>();
        for (AuditLog log : auditRepository.findByActionOrderByTimestampDesc(IN_BIN)) {
            out.add(toEntry(log, decode(log.getDescription())));
        }
        return out;
    }

    /** Puts a deleted purchase back exactly as it was, undoing everything its deletion did. */
    public PurchaseBinEntry restore(Long binId, String username) {
        AuditLog log = auditRepository.findById(binId)
                .orElseThrow(() -> new ResourceNotFoundException("Bin entry not found with id: " + binId));
        if (RESTORED.equals(log.getAction())) {
            throw new IllegalArgumentException("This purchase has already been restored");
        }
        if (!IN_BIN.equals(log.getAction())) {
            throw new IllegalArgumentException("This purchase is no longer in the bin");
        }
        if (expired(log, LocalDateTime.now())) {
            expire(log);
            throw new IllegalArgumentException("Deleted purchases are kept for " + KEEP_DAYS
                    + " days only — this one can no longer be restored");
        }
        Snapshot s = decode(log.getDescription());
        PurchaseData pd = s.purchase;

        purchaseRepository.findByInvoiceNumber(pd.invoiceNumber).ifPresent(other -> {
            throw new IllegalArgumentException("Invoice " + pd.invoiceNumber + " has been recorded again since it was "
                    + "deleted. Delete that copy first if you want this one back.");
        });
        for (ItemData it : s.items) {
            if (!componentRepository.existsById(it.componentId)) {
                throw new IllegalArgumentException("The component \"" + it.componentName + "\" no longer exists, "
                        + "so this purchase cannot be restored");
            }
        }

        Long purchaseId = purchaseRepository.existsById(pd.id) ? null : pd.id;
        Long projectId = pd.projectId != null && projectRepository.existsById(pd.projectId) ? pd.projectId : null;
        Long supplierId = pd.supplierId != null && supplierRepository.existsById(pd.supplierId) ? pd.supplierId : null;
        if (purchaseId == null) {
            throw new IllegalStateException("Purchase id " + pd.id + " is already in use");
        }
        jdbc.update("insert into purchases (id, created_at, created_by, invoice_file_original_name, invoice_file_path, "
                + "invoice_file_stored_name, invoice_number, invoice_processing_status, purchase_date, remarks, "
                + "supplier_name, total_amount, updated_at, supplier_id, invoice_uploaded_at, invoice_uploaded_by, "
                + "project_id) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                purchaseId, pd.createdAt, pd.createdBy, pd.invoiceFileOriginalName, pd.invoiceFilePath,
                pd.invoiceFileStoredName, pd.invoiceNumber, pd.invoiceProcessingStatus, pd.purchaseDate, pd.remarks,
                pd.supplierName, pd.totalAmount, pd.updatedAt, supplierId, pd.invoiceUploadedAt, pd.invoiceUploadedBy,
                projectId);
        for (ItemData it : s.items) {
            if (it.id != null && !itemRepository.existsById(it.id)) {
                jdbc.update("insert into purchase_items (id, quantity, total_price, unit_price, component_id, purchase_id) "
                        + "values (?,?,?,?,?,?)", it.id, it.quantity, it.totalPrice, it.unitPrice, it.componentId, purchaseId);
            } else {
                jdbc.update("insert into purchase_items (quantity, total_price, unit_price, component_id, purchase_id) "
                        + "values (?,?,?,?,?)", it.quantity, it.totalPrice, it.unitPrice, it.componentId, purchaseId);
            }
        }

        if (s.componentsRemoved) {
            for (StockData d : s.stock) {
                ComponentItem c = componentRepository.findById(d.componentId).orElse(null);
                if (c == null) {
                    continue;
                }
                if (d.quantity > 0) {
                    c.setQuantity(nz(c.getQuantity()) + d.quantity);
                    transactionRepository.save(InventoryTransaction.builder()
                            .component(c)
                            .transactionType(TransactionType.STOCK_IN)
                            .quantity(d.quantity)
                            .remarks("Invoice restored from bin: " + pd.invoiceNumber)
                            .createdBy(username)
                            .build());
                }
                if (d.archived && c.getStatus() == ComponentStatus.ARCHIVED) {
                    c.setStatus(ComponentStatus.valueOf(d.previousStatus));
                }
                componentRepository.save(c);
            }
            for (FolderData f : s.folderEntries) {
                if (!projectRepository.existsById(f.projectId) || !componentRepository.existsById(f.componentId)) {
                    continue;
                }
                Long entryId = f.id != null && !stockRepository.existsById(f.id) ? f.id : null;
                jdbc.update("insert into project_stock (id, created_at, created_by, notes, purchase_id, quantity, source, "
                        + "unit_price, component_id, project_id) values (?,?,?,?,?,?,?,?,?,?)",
                        entryId, f.createdAt, f.createdBy, f.notes, purchaseId, f.quantity, f.source, f.unitPrice,
                        f.componentId, f.projectId);
            }
        }
        for (Long eqId : s.equipmentIds) {
            equipmentRepository.findById(eqId).filter(eq -> eq.getPurchaseId() == null).ifPresent(eq -> {
                eq.setPurchaseId(purchaseId);
                equipmentRepository.save(eq);
            });
        }

        log.setAction(RESTORED);
        auditRepository.save(log);
        return toEntry(log, s);
    }

    // ------------------------------------------------------------------ helpers

    /** One component bought on the invoice and what removing it would do. */
    private static final class Removal {
        final ComponentItem component;
        int invoiceQty;
        int remove;
        boolean archive;

        Removal(ComponentItem component) {
            this.component = component;
        }
    }

    private List<Removal> removals(Purchase p) {
        Map<Long, Removal> byComponent = new LinkedHashMap<>();
        for (PurchaseItem it : p.getItems()) {
            byComponent.computeIfAbsent(it.getComponent().getId(), k -> new Removal(it.getComponent())).invoiceQty
                    += nz(it.getQuantity());
        }
        for (Removal r : byComponent.values()) {
            int stock = Math.max(nz(r.component.getQuantity()), 0);
            r.remove = Math.min(r.invoiceQty, stock);
            // Archive only a part that exists because of this invoice alone: created with
            // it, bought on no other purchase, and left with nothing in stock.
            r.archive = stock - r.remove == 0
                    && r.component.getStatus() != ComponentStatus.ARCHIVED
                    && createdWith(r.component, p)
                    && itemRepository.countByComponentIdAndPurchaseIdNot(r.component.getId(), p.getId()) == 0;
        }
        return new ArrayList<>(byComponent.values());
    }

    static boolean createdWith(ComponentItem c, Purchase p) {
        return c.getCreatedAt() != null && p.getCreatedAt() != null
                && Math.abs(Duration.between(c.getCreatedAt(), p.getCreatedAt()).toMinutes()) <= 10;
    }

    private void expireOld() {
        LocalDateTime now = LocalDateTime.now();
        for (AuditLog log : auditRepository.findByActionOrderByTimestampDesc(IN_BIN)) {
            if (expired(log, now)) {
                expire(log);
            }
        }
    }

    private static boolean expired(AuditLog log, LocalDateTime now) {
        return log.getTimestamp().plusDays(KEEP_DAYS).isBefore(now);
    }

    /** After the retention period the copy is discarded; a one-line record stays in the audit log. */
    private void expire(AuditLog log) {
        String summary;
        try {
            PurchaseData pd = decode(log.getDescription()).purchase;
            summary = "Invoice " + pd.invoiceNumber + " from " + pd.supplierName + " (" + pd.totalAmount
                    + ") — deleted; removed from the bin after " + KEEP_DAYS + " days";
        } catch (RuntimeException ex) {
            summary = "Deleted purchase — removed from the bin after " + KEEP_DAYS + " days";
        }
        log.setAction(EXPIRED);
        log.setDescription(summary);
        auditRepository.save(log);
    }

    private PurchaseBinEntry toEntry(AuditLog log, Snapshot s) {
        PurchaseBinEntry e = new PurchaseBinEntry();
        e.setId(log.getId());
        e.setPurchaseId(s.purchase.id);
        e.setInvoiceNumber(s.purchase.invoiceNumber);
        e.setSupplierName(s.purchase.supplierName);
        e.setTotalAmount(s.purchase.totalAmount);
        e.setPurchaseDate(s.purchase.purchaseDate);
        e.setProjectName(s.purchase.projectName);
        e.setItemCount(s.items.size());
        e.setDeletedAt(log.getTimestamp());
        e.setDeletedBy(log.getUser());
        e.setComponentsRemoved(s.componentsRemoved);
        e.setUnitsRemoved(s.stock.stream().mapToInt(d -> d.quantity).sum());
        LocalDateTime expires = log.getTimestamp().plusDays(KEEP_DAYS);
        e.setExpiresAt(expires);
        long hours = Duration.between(LocalDateTime.now(), expires).toHours();
        e.setDaysLeft((int) Math.max(0, Math.ceil(hours / 24.0)));
        return e;
    }

    String encode(Snapshot s) {
        try {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try (GZIPOutputStream gz = new GZIPOutputStream(bytes)) {
                gz.write(json.writeValueAsBytes(s));
            }
            String text = PREFIX + Base64.getEncoder().encodeToString(bytes.toByteArray());
            if (text.length() > TEXT_MAX) {
                throw new IllegalArgumentException("This purchase is too large to keep in the bin");
            }
            return text;
        } catch (IOException ex) {
            throw new IllegalStateException("Could not keep a copy of the purchase", ex);
        }
    }

    Snapshot decode(String text) {
        if (text == null || !text.startsWith(PREFIX)) {
            throw new IllegalStateException("The bin copy of this purchase is missing");
        }
        try (GZIPInputStream gz = new GZIPInputStream(
                new ByteArrayInputStream(Base64.getDecoder().decode(text.substring(PREFIX.length()))))) {
            return json.readValue(new String(gz.readAllBytes(), StandardCharsets.UTF_8), Snapshot.class);
        } catch (IOException ex) {
            throw new IllegalStateException("The bin copy of this purchase could not be read", ex);
        }
    }

    private Purchase require(Long id) {
        return purchaseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase not found with id: " + id));
    }

    private static int nz(Integer i) {
        return i == null ? 0 : i;
    }

    // ------------------------------------------------------------------ the copy kept in the bin

    /** Everything a deletion removed, so a restore can put it back. */
    public static class Snapshot {
        public PurchaseData purchase;
        public List<ItemData> items = new ArrayList<>();
        public List<Long> equipmentIds = new ArrayList<>();
        public boolean componentsRemoved;
        public List<StockData> stock = new ArrayList<>();
        public List<FolderData> folderEntries = new ArrayList<>();
    }

    public static class PurchaseData {
        public Long id;
        public Long supplierId;
        public String supplierName;
        public String invoiceNumber;
        public LocalDate purchaseDate;
        public BigDecimal totalAmount;
        public String invoiceFilePath;
        public String invoiceFileOriginalName;
        public String invoiceFileStoredName;
        public LocalDateTime invoiceUploadedAt;
        public String invoiceUploadedBy;
        public String invoiceProcessingStatus;
        public String remarks;
        public Long projectId;
        public String projectName;
        public String createdBy;
        public LocalDateTime createdAt;
        public LocalDateTime updatedAt;

        static PurchaseData of(Purchase p) {
            PurchaseData d = new PurchaseData();
            d.id = p.getId();
            d.supplierId = p.getSupplier() != null ? p.getSupplier().getId() : null;
            d.supplierName = p.getSupplierName();
            d.invoiceNumber = p.getInvoiceNumber();
            d.purchaseDate = p.getPurchaseDate();
            d.totalAmount = p.getTotalAmount();
            d.invoiceFilePath = p.getInvoiceFilePath();
            d.invoiceFileOriginalName = p.getInvoiceFileOriginalName();
            d.invoiceFileStoredName = p.getInvoiceFileStoredName();
            d.invoiceUploadedAt = p.getInvoiceUploadedAt();
            d.invoiceUploadedBy = p.getInvoiceUploadedBy();
            d.invoiceProcessingStatus = p.getInvoiceProcessingStatus() != null ? p.getInvoiceProcessingStatus().name() : null;
            d.remarks = p.getRemarks();
            d.projectId = p.getProject() != null ? p.getProject().getId() : null;
            d.projectName = p.getProject() != null ? p.getProject().getProjectName() : null;
            d.createdBy = p.getCreatedBy();
            d.createdAt = p.getCreatedAt();
            d.updatedAt = p.getUpdatedAt();
            return d;
        }
    }

    public static class ItemData {
        public Long id;
        public Long componentId;
        public String componentName;
        public Integer quantity;
        public BigDecimal unitPrice;
        public BigDecimal totalPrice;

        static ItemData of(PurchaseItem it) {
            ItemData d = new ItemData();
            d.id = it.getId();
            d.componentId = it.getComponent().getId();
            d.componentName = it.getComponent().getComponentName();
            d.quantity = it.getQuantity();
            d.unitPrice = it.getUnitPrice();
            d.totalPrice = it.getTotalPrice();
            return d;
        }
    }

    public static class StockData {
        public Long componentId;
        public String componentName;
        public int quantity;
        public boolean archived;
        public String previousStatus;
    }

    public static class FolderData {
        public Long id;
        public Long projectId;
        public Long componentId;
        public int quantity;
        public BigDecimal unitPrice;
        public String source;
        public String notes;
        public String createdBy;
        public LocalDateTime createdAt;

        static FolderData of(ProjectStock e) {
            FolderData d = new FolderData();
            d.id = e.getId();
            d.projectId = e.getProject().getId();
            d.componentId = e.getComponent().getId();
            d.quantity = e.getQuantity();
            d.unitPrice = e.getUnitPrice();
            d.source = e.getSource();
            d.notes = e.getNotes();
            d.createdBy = e.getCreatedBy();
            d.createdAt = e.getCreatedAt();
            return d;
        }
    }
}
