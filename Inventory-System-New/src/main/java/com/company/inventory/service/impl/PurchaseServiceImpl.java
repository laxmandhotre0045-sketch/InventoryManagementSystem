package com.company.inventory.service.impl;

import com.company.inventory.dto.request.PurchaseItemRequest;
import com.company.inventory.dto.request.PurchaseRequest;
import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.dto.response.PurchaseResponse;
import com.company.inventory.dto.response.PurchaseSummaryResponse;
import com.company.inventory.entity.ComponentItem;
import com.company.inventory.entity.InventoryTransaction;
import com.company.inventory.entity.Purchase;
import com.company.inventory.entity.PurchaseItem;
import com.company.inventory.entity.TransactionType;
import com.company.inventory.exception.InsufficientStockException;
import com.company.inventory.exception.ResourceNotFoundException;
import com.company.inventory.mapper.PurchaseMapper;
import com.company.inventory.repository.ComponentRepository;
import com.company.inventory.repository.InventoryTransactionRepository;
import com.company.inventory.repository.PurchaseItemRepository;
import com.company.inventory.repository.PurchaseRepository;
import com.company.inventory.repository.SupplierRepository;
import com.company.inventory.service.FileStorageService;
import com.company.inventory.service.PurchaseService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class PurchaseServiceImpl implements PurchaseService {

    private final PurchaseRepository purchaseRepository;
    private final PurchaseItemRepository purchaseItemRepository;
    private final ComponentRepository componentRepository;
    private final InventoryTransactionRepository transactionRepository;
    private final SupplierRepository supplierRepository;
    private final FileStorageService fileStorageService;
    private final PurchaseMapper purchaseMapper;
    private final com.company.inventory.service.InvoiceExtractionService invoiceExtractionService;
    private final com.company.inventory.repository.EquipmentRepository equipmentRepository;
    private final com.company.inventory.service.SpecificationService specificationService;
    private final com.company.inventory.service.ItemCodeGenerator itemCodeGenerator;
    private final com.company.inventory.service.ComponentCategoryService componentCategoryService;
    private final com.company.inventory.repository.ProjectRepository projectRepository;
    private final ProjectStockService projectStockService;

    public PurchaseServiceImpl(PurchaseRepository purchaseRepository,
                               PurchaseItemRepository purchaseItemRepository,
                               ComponentRepository componentRepository,
                               InventoryTransactionRepository transactionRepository,
                               SupplierRepository supplierRepository,
                               FileStorageService fileStorageService,
                               PurchaseMapper purchaseMapper,
                               com.company.inventory.service.InvoiceExtractionService invoiceExtractionService,
                               com.company.inventory.repository.EquipmentRepository equipmentRepository,
                               com.company.inventory.service.ItemCodeGenerator itemCodeGenerator,
                               com.company.inventory.service.ComponentCategoryService componentCategoryService,
                               com.company.inventory.service.SpecificationService specificationService,
                               com.company.inventory.repository.ProjectRepository projectRepository,
                               ProjectStockService projectStockService) {
        this.specificationService = specificationService;
        this.projectRepository = projectRepository;
        this.projectStockService = projectStockService;
        this.purchaseRepository = purchaseRepository;
        this.purchaseItemRepository = purchaseItemRepository;
        this.componentRepository = componentRepository;
        this.transactionRepository = transactionRepository;
        this.supplierRepository = supplierRepository;
        this.fileStorageService = fileStorageService;
        this.purchaseMapper = purchaseMapper;
        this.invoiceExtractionService = invoiceExtractionService;
        this.equipmentRepository = equipmentRepository;
        this.itemCodeGenerator = itemCodeGenerator;
        this.componentCategoryService = componentCategoryService;
    }

    /**
     * Finalise a reviewed invoice as one atomic unit. The class-level
     * {@code @Transactional} guarantees that if any step fails (e.g. a duplicate
     * name, a bad quantity), every change — new components/equipment, the
     * purchase, stock increments and transactions — rolls back together, leaving
     * inventory consistent.
     */
    @Override
    public PurchaseResponse confirmInvoicePurchase(
            com.company.inventory.dto.request.ConfirmInvoiceRequest request, String username) {

        Purchase purchase = new Purchase();
        purchase.setSupplierName(request.getSupplierName());
        purchase.setInvoiceNumber(request.getInvoiceNumber());
        purchase.setPurchaseDate(request.getPurchaseDate() != null ? request.getPurchaseDate() : LocalDate.now());
        purchase.setRemarks(request.getRemarks());
        purchase.setCreatedBy(username);
        purchase.setInvoiceProcessingStatus(com.company.inventory.entity.InvoiceProcessingStatus.UPLOADED);
        // Scanned from inside a project: the purchase and every component line belong to it.
        com.company.inventory.entity.Project project = null;
        if (request.getProjectId() != null) {
            project = projectRepository.findById(request.getProjectId()).orElseThrow(
                    () -> new ResourceNotFoundException("Project not found with id: " + request.getProjectId()));
            purchase.setProject(project);
        }
        if (request.getInvoiceFilePath() != null && !request.getInvoiceFilePath().isBlank()) {
            purchase.setInvoiceFilePath(request.getInvoiceFilePath());
            // Same provenance as a manual upload, so the invoice list can show it.
            purchase.setInvoiceUploadedAt(java.time.LocalDateTime.now());
            purchase.setInvoiceUploadedBy(username);
        }

        BigDecimal totalAmount = BigDecimal.ZERO;
        List<PurchaseItem> items = new java.util.ArrayList<>();
        // Equipment is registered as an asset rather than stocked, so it produces no
        // PurchaseItem. It is still something the invoice was paid for, so it counts
        // towards the purchase total and towards "this invoice had something on it".
        int equipmentLines = 0;

        // Seed running item-code counters from the current maxima and increment
        // locally per newly created item. This assigns C####/E#### codes to items
        // created here (previously they were saved code-less) and cannot collide
        // even when several new items are created in the same invoice.
        long compCodeNum = itemCodeGenerator.currentComponentNumber();
        long equipCodeNum = itemCodeGenerator.currentEquipmentNumber();
        // Equipment from this invoice, linked to the purchase once it has an id (below).
        List<com.company.inventory.entity.Equipment> equipmentToLink = new java.util.ArrayList<>();

        for (com.company.inventory.dto.request.ConfirmInvoiceItemRequest line : request.getItems()) {
            com.company.inventory.dto.request.ItemResolution res = line.getResolution();
            if (res == null || res == com.company.inventory.dto.request.ItemResolution.SKIP) {
                continue;
            }

            // Equipment lines register an asset but never affect stock or the purchase items.
            if (res == com.company.inventory.dto.request.ItemResolution.NEW_EQUIPMENT) {
                String eqFullName = requireName(line, "register new equipment");
                String eqName = fitName(eqFullName, NAME_MAX);
                com.company.inventory.entity.Equipment newEq = equipmentRepository.save(com.company.inventory.entity.Equipment.builder()
                        .itemCode(itemCodeGenerator.buildCode(
                                com.company.inventory.service.ItemCodeGenerator.EQUIPMENT_PREFIX, ++equipCodeNum))
                        .name(eqName)
                        .notes(eqName.equals(eqFullName) ? null : eqFullName)
                        .serialNumber(line.getSerialNumber())
                        .category(line.getCategory())
                        .manufacturer(line.getManufacturer())
                        .purchaseDate(request.getPurchaseDate())
                        .status("ACTIVE")
                        .build());
                equipmentLines++;
                totalAmount = totalAmount.add(lineValue(line));
                equipmentToLink.add(newEq);
                specificationService.addMissing(com.company.inventory.entity.ItemSpecification.EQUIPMENT,
                        newEq.getId(), invoiceDetails(line));
                continue;
            }
            if (res == com.company.inventory.dto.request.ItemResolution.EXISTING_EQUIPMENT) {
                com.company.inventory.entity.Equipment eq = line.getEquipmentId() == null ? null
                        : equipmentRepository.findById(line.getEquipmentId()).orElse(null);
                if (eq == null) {
                    throw new ResourceNotFoundException("Equipment not found with id: " + line.getEquipmentId());
                }
                equipmentLines++;
                totalAmount = totalAmount.add(lineValue(line));
                // Only claim it if it is not already tied to another purchase.
                if (eq.getPurchaseId() == null) {
                    equipmentToLink.add(eq);
                }
                continue;
            }

            // Component lines: resolve an existing component or create a new one (with an item code), then stock-in.
            ComponentItem component;
            if (res == com.company.inventory.dto.request.ItemResolution.EXISTING_COMPONENT) {
                component = componentRepository.findById(line.getComponentId())
                        .orElseThrow(() -> new ResourceNotFoundException("Component not found with id: " + line.getComponentId()));
            } else {
                // Supplier listings (Robu, LCSC...) often run past the 150 characters the name
                // column holds; one such line used to fail the whole invoice. The name is
                // shortened at a word boundary and the full text kept in the description.
                String fullName = requireName(line, "create a new component");
                String name = fitName(fullName, NAME_MAX);
                ComponentItem existing = componentRepository.findByComponentName(name).orElse(null);
                if (existing != null) {
                    component = existing; // reuse — don't consume a code number
                } else {
                    component = componentRepository.save(ComponentItem.builder()
                            .itemCode(itemCodeGenerator.buildCode(
                                    com.company.inventory.service.ItemCodeGenerator.COMPONENT_PREFIX, ++compCodeNum))
                            .componentName(name)
                            .description(name.equals(fullName) ? null : fullName)
                            // Category text off an invoice is free-form, so it is matched
                            // case-insensitively against existing categories and only
                            // creates one when genuinely new. A line with no category at
                            // all lands in "Uncategorized" rather than blocking the import.
                            .category(componentCategoryService.resolveOrCreate(line.getCategory()))
                            // Category › Type › Value as confirmed on the review screen.
                            .type(trimTo(line.getType(), 100))
                            .value(trimTo(line.getValue(), 100))
                            .quantity(0)
                            .minimumQuantity(0)
                            .unit(line.getUnit() != null ? line.getUnit() : "pcs")
                            .status(com.company.inventory.entity.ComponentStatus.ACTIVE)
                            .build());
                    // Details read off the invoice become editable specifications.
                    specificationService.addMissing(com.company.inventory.entity.ItemSpecification.COMPONENT,
                            component.getId(), invoiceDetails(line));
                }
            }

            if (line.getQuantity() == null || line.getQuantity() <= 0) {
                throw new IllegalArgumentException("Quantity must be greater than 0 for " + component.getComponentName());
            }
            if (line.getUnitPrice() == null || line.getUnitPrice().compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("Unit price must be greater than 0 for " + component.getComponentName());
            }

            BigDecimal totalPrice = line.getUnitPrice().multiply(BigDecimal.valueOf(line.getQuantity()));
            totalAmount = totalAmount.add(totalPrice);

            component.setQuantity(component.getQuantity() + line.getQuantity());
            // The invoice is the authoritative cost, so it becomes the component's unit
            // price and the stock is valued at what was actually paid for it.
            component.setUnitPrice(line.getUnitPrice());
            componentRepository.save(component);

            transactionRepository.save(InventoryTransaction.builder()
                    .component(component)
                    .transactionType(TransactionType.STOCK_IN)
                    .quantity(line.getQuantity())
                    .remarks("Invoice stock in: " + request.getInvoiceNumber())
                    .createdBy(username)
                    .build());

            items.add(PurchaseItem.builder()
                    .purchase(purchase)
                    .component(component)
                    .quantity(line.getQuantity())
                    .unitPrice(line.getUnitPrice())
                    .totalPrice(totalPrice)
                    .build());
        }

        // An invoice can legitimately contain no stockable components at all — buying a
        // single instrument, for example. Requiring a component line here rejected those
        // outright, with the equipment already registered and then rolled back. What must
        // not be accepted is an invoice where every line was skipped.
        if (items.isEmpty() && equipmentLines == 0) {
            throw new IllegalArgumentException(
                    "Resolve at least one line to a component or equipment before confirming — "
                    + "every line is currently set to skip.");
        }

        purchase.setTotalAmount(totalAmount);
        purchase.setItems(items);
        Purchase saved = purchaseRepository.save(purchase);
        for (com.company.inventory.entity.Equipment eq : equipmentToLink) {
            eq.setPurchaseId(saved.getId());
            equipmentRepository.save(eq);
        }
        if (project != null) {
            for (PurchaseItem item : saved.getItems()) {
                projectStockService.addFromInvoice(project, item.getComponent(), item.getQuantity(),
                        item.getUnitPrice(), saved.getId(), saved.getInvoiceNumber(), username);
            }
        }
        invoiceExtractionService.markConfirmed(request.getExtractionId(), saved.getId());
        return purchaseMapper.toResponse(saved);
    }

    /** A line's money value, tolerating the blanks an equipment line may carry. */
    private BigDecimal lineValue(com.company.inventory.dto.request.ConfirmInvoiceItemRequest line) {
        if (line.getUnitPrice() == null || line.getQuantity() == null || line.getQuantity() <= 0) {
            return BigDecimal.ZERO;
        }
        return line.getUnitPrice().multiply(BigDecimal.valueOf(line.getQuantity()));
    }

    /** Supplier code, HSN and package from an invoice line, as specification rows. */
    private static List<com.company.inventory.dto.response.SpecificationEntry> invoiceDetails(
            com.company.inventory.dto.request.ConfirmInvoiceItemRequest line) {
        List<com.company.inventory.dto.response.SpecificationEntry> out = new java.util.ArrayList<>();
        if (line.getSupplierItemCode() != null && !line.getSupplierItemCode().isBlank()) {
            out.add(new com.company.inventory.dto.response.SpecificationEntry("Supplier part code", line.getSupplierItemCode().trim()));
        }
        if (line.getPackageName() != null && !line.getPackageName().isBlank()) {
            out.add(new com.company.inventory.dto.response.SpecificationEntry("Package", line.getPackageName().trim()));
        }
        if (line.getHsnCode() != null && !line.getHsnCode().isBlank()) {
            out.add(new com.company.inventory.dto.response.SpecificationEntry("HSN code", line.getHsnCode().trim()));
        }
        return out;
    }

    /** components.component_name and equipment.name are both VARCHAR(150). */
    private static final int NAME_MAX = 150;

    /**
     * Fits a name into {@code max} characters, cutting at the last word boundary rather
     * than mid-word, and dropping the dangling separator ("… SOT-223 Voltag" -> "… SOT-223").
     */
    static String fitName(String s, int max) {
        String t = s.trim();
        if (t.length() <= max) {
            return t;
        }
        String cut = t.substring(0, max);
        int space = cut.lastIndexOf(' ');
        if (space >= max * 0.6) {
            cut = cut.substring(0, space);
        }
        return cut.replaceAll("[\\s,;:(\\-–—/]+$", "").trim();
    }

    private static String trimTo(String s, int max) {
        if (s == null || s.isBlank()) {
            return null;
        }
        String t = s.trim();
        return t.length() > max ? t.substring(0, max) : t;
    }

    private String requireName(com.company.inventory.dto.request.ConfirmInvoiceItemRequest line, String action) {
        String name = line.getName() != null ? line.getName().trim() : null;
        if (name == null || name.isEmpty()) {
            throw new IllegalArgumentException("A name is required to " + action);
        }
        return name;
    }

    @Override
    public PurchaseResponse createPurchase(PurchaseRequest request, String username) {
        Purchase purchase = new Purchase();
        
        if (request.getSupplierId() != null) {
            purchase.setSupplier(supplierRepository.findById(request.getSupplierId()).orElse(null));
        }
        purchase.setSupplierName(request.getSupplierName());
        purchase.setInvoiceNumber(request.getInvoiceNumber());
        purchase.setPurchaseDate(request.getPurchaseDate() != null ? request.getPurchaseDate() : LocalDate.now());
        purchase.setRemarks(request.getRemarks());
        purchase.setCreatedBy(username);
        purchase.setInvoiceProcessingStatus(com.company.inventory.entity.InvoiceProcessingStatus.UPLOADED);
        // Attach an invoice already stored by /extract-invoice, when provided.
        if (request.getInvoiceFilePath() != null && !request.getInvoiceFilePath().isBlank()) {
            purchase.setInvoiceFilePath(request.getInvoiceFilePath());
            purchase.setInvoiceUploadedAt(java.time.LocalDateTime.now());
            purchase.setInvoiceUploadedBy(username);
        }

        BigDecimal totalAmount = BigDecimal.ZERO;
        List<PurchaseItem> items = new java.util.ArrayList<>();
        for (PurchaseItemRequest itemRequest : request.getItems()) {
            ComponentItem component = componentRepository.findById(itemRequest.getComponentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Component not found with id: " + itemRequest.getComponentId()));

            if (itemRequest.getQuantity() == null || itemRequest.getQuantity() <= 0) {
                throw new IllegalArgumentException("Quantity must be greater than 0");
            }
            if (itemRequest.getUnitPrice() == null || itemRequest.getUnitPrice().compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("Unit price must be greater than 0");
            }

            BigDecimal totalPrice = itemRequest.getUnitPrice().multiply(BigDecimal.valueOf(itemRequest.getQuantity()));
            totalAmount = totalAmount.add(totalPrice);

            component.setQuantity(component.getQuantity() + itemRequest.getQuantity());
            // Purchase price flows onto the component so the valuation reflects it.
            component.setUnitPrice(itemRequest.getUnitPrice());
            componentRepository.save(component);

            InventoryTransaction transaction = InventoryTransaction.builder()
                    .component(component)
                    .transactionType(TransactionType.STOCK_IN)
                    .quantity(itemRequest.getQuantity())
                    .remarks("Purchase stock in: " + request.getInvoiceNumber())
                    .createdBy(username)
                    .build();
            transactionRepository.save(transaction);

            PurchaseItem purchaseItem = PurchaseItem.builder()
                    .purchase(purchase)
                    .component(component)
                    .quantity(itemRequest.getQuantity())
                    .unitPrice(itemRequest.getUnitPrice())
                    .totalPrice(totalPrice)
                    .build();
            items.add(purchaseItem);
        }

        purchase.setTotalAmount(totalAmount);
        purchase.setItems(items);
        Purchase savedPurchase = purchaseRepository.save(purchase);
        // Link the extraction record (if this purchase came from an uploaded invoice).
        invoiceExtractionService.markConfirmed(request.getExtractionId(), savedPurchase.getId());
        return purchaseMapper.toResponse(savedPurchase);
    }

    @Override
    public PurchaseResponse uploadInvoice(Long purchaseId, MultipartFile file, String username) {
        Purchase purchase = purchaseRepository.findById(purchaseId)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase not found with id: " + purchaseId));
        String path = fileStorageService.storeInvoice(file);
        purchase.setInvoiceFilePath(path);
        purchase.setInvoiceFileOriginalName(file.getOriginalFilename());
        purchase.setInvoiceFileStoredName(path);
        // Recorded so the invoice list can show who attached the document and when,
        // which updatedAt cannot answer once anything else on the purchase changes.
        purchase.setInvoiceUploadedAt(java.time.LocalDateTime.now());
        purchase.setInvoiceUploadedBy(username);
        purchase.setInvoiceProcessingStatus(com.company.inventory.entity.InvoiceProcessingStatus.UPLOADED);
        Purchase updated = purchaseRepository.save(purchase);
        return purchaseMapper.toResponse(updated);
    }

    @Override
    public PurchaseResponse getPurchaseById(Long id) {
        Purchase purchase = purchaseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase not found with id: " + id));
        return purchaseMapper.toResponse(purchase);
    }

    @Override
    @Transactional(readOnly = true)
    public com.company.inventory.dto.response.PurchaseDetailResponse getPurchaseDetails(Long id) {
        Purchase purchase = purchaseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase not found with id: " + id));

        com.company.inventory.dto.response.PurchaseDetailResponse detail =
                new com.company.inventory.dto.response.PurchaseDetailResponse();
        detail.setPurchase(purchaseMapper.toResponse(purchase));

        if (purchase.getItems() != null) {
            for (PurchaseItem item : purchase.getItems()) {
                ComponentItem c = item.getComponent();
                com.company.inventory.dto.response.PurchaseDetailResponse.ComponentLine line =
                        new com.company.inventory.dto.response.PurchaseDetailResponse.ComponentLine();
                line.setPurchaseItemId(item.getId());
                line.setQuantityPurchased(item.getQuantity());
                line.setUnitPricePaid(item.getUnitPrice());
                line.setLineTotal(item.getTotalPrice());
                if (c != null) {
                    line.setComponentId(c.getId());
                    line.setItemCode(c.getItemCode());
                    line.setComponentName(c.getComponentName());
                    line.setCategory(c.getCategory() != null ? c.getCategory().getName() : null);
                    line.setType(c.getType());
                    line.setValue(c.getValue());
                    line.setDescription(c.getDescription());
                    line.setUnit(c.getUnit());
                    line.setLocation(c.getLocation());
                    line.setRackNo(c.getRackNo());
                    line.setStatus(c.getStatus() != null ? c.getStatus().name() : null);
                    line.setCurrentStock(c.getQuantity());
                    line.setMinimumQuantity(c.getMinimumQuantity());
                    line.setCurrentUnitPrice(c.getUnitPrice());
                }
                detail.getComponents().add(line);
            }
        }

        for (com.company.inventory.entity.Equipment eq : equipmentRepository.findByPurchaseIdOrderByIdAsc(id)) {
            com.company.inventory.dto.response.PurchaseDetailResponse.EquipmentLine line =
                    new com.company.inventory.dto.response.PurchaseDetailResponse.EquipmentLine();
            line.setEquipmentId(eq.getId());
            line.setItemCode(eq.getItemCode());
            line.setName(eq.getName());
            line.setSerialNumber(eq.getSerialNumber());
            line.setCategory(eq.getCategory());
            line.setManufacturer(eq.getManufacturer());
            line.setStatus(eq.getStatus());
            line.setLocation(eq.getLocation());
            line.setPurchaseDate(eq.getPurchaseDate());
            line.setWarrantyExpiry(eq.getWarrantyExpiry());
            line.setNotes(eq.getNotes());
            detail.getEquipment().add(line);
        }
        return detail;
    }

    @Override
    public org.springframework.core.io.Resource loadInvoiceFile(Long purchaseId) {
        return fileStorageService.loadInvoice(invoicePathOf(purchaseId));
    }

    @Override
    public String invoiceContentType(Long purchaseId) {
        return fileStorageService.contentTypeOf(invoicePathOf(purchaseId));
    }

    private String invoicePathOf(Long purchaseId) {
        Purchase purchase = purchaseRepository.findById(purchaseId)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase not found with id: " + purchaseId));
        String path = purchase.getInvoiceFilePath();
        if (path == null || path.isBlank()) {
            throw new ResourceNotFoundException("No invoice has been uploaded for this purchase");
        }
        return path;
    }

    @Override
    public PagedResponse<PurchaseResponse> getAllPurchases(int page, int size, String sortBy, String sortDir) {
        Pageable pageable = createPageable(page, size, sortBy, sortDir);
        Page<Purchase> pageData = purchaseRepository.findAll(pageable);
        return mapPage(pageData);
    }

    @Override
    public PagedResponse<PurchaseResponse> searchPurchases(String keyword, int page, int size, String sortBy, String sortDir) {
        Pageable pageable = createPageable(page, size, sortBy, sortDir);
        Page<Purchase> pageData = purchaseRepository.findBySupplierNameContainingIgnoreCaseOrInvoiceNumberContainingIgnoreCase(keyword, keyword, pageable);
        return mapPage(pageData);
    }

    @Override
    public void deletePurchase(Long id) {
        Purchase purchase = purchaseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase not found with id: " + id));
        // The equipment itself stays — only its link to the deleted purchase is cleared.
        for (com.company.inventory.entity.Equipment eq : equipmentRepository.findByPurchaseIdOrderByIdAsc(id)) {
            eq.setPurchaseId(null);
            equipmentRepository.save(eq);
        }
        purchaseRepository.delete(purchase);
    }

    @Override
    public PurchaseSummaryResponse getPurchaseSummary(Long id) {
        Purchase purchase = purchaseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase not found with id: " + id));

        PurchaseSummaryResponse summary = new PurchaseSummaryResponse();
        summary.setPurchaseId(purchase.getId());
        summary.setSupplierName(purchase.getSupplierName());
        summary.setInvoiceNumber(purchase.getInvoiceNumber());
        summary.setTotalAmount(purchase.getTotalAmount());
        summary.setItems(purchase.getItems().stream().map(item -> {
            PurchaseSummaryResponse.PurchaseItemSummary row = new PurchaseSummaryResponse.PurchaseItemSummary();
            row.setComponentName(item.getComponent().getComponentName());
            row.setQuantity(item.getQuantity());
            row.setUnitPrice(item.getUnitPrice());
            return row;
        }).collect(Collectors.toList()));
        return summary;
    }

    private Pageable createPageable(int page, int size, String sortBy, String sortDir) {
        Sort sort = Sort.by(sortBy);
        sort = "desc".equalsIgnoreCase(sortDir) ? sort.descending() : sort.ascending();
        return PageRequest.of(page, size, sort);
    }

    private PagedResponse<PurchaseResponse> mapPage(Page<Purchase> pageData) {
        PagedResponse<PurchaseResponse> response = new PagedResponse<>();
        response.setContent(pageData.stream().map(purchaseMapper::toResponse).collect(Collectors.toList()));
        response.setPage(pageData.getNumber());
        response.setSize(pageData.getSize());
        response.setTotalElements(pageData.getTotalElements());
        response.setTotalPages(pageData.getTotalPages());
        response.setLast(pageData.isLast());
        return response;
    }
}
