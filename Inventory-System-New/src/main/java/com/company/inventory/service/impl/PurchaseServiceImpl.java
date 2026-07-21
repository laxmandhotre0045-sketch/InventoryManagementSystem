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

    public PurchaseServiceImpl(PurchaseRepository purchaseRepository,
                               PurchaseItemRepository purchaseItemRepository,
                               ComponentRepository componentRepository,
                               InventoryTransactionRepository transactionRepository,
                               SupplierRepository supplierRepository,
                               FileStorageService fileStorageService,
                               PurchaseMapper purchaseMapper) {
        this.purchaseRepository = purchaseRepository;
        this.purchaseItemRepository = purchaseItemRepository;
        this.componentRepository = componentRepository;
        this.transactionRepository = transactionRepository;
        this.supplierRepository = supplierRepository;
        this.fileStorageService = fileStorageService;
        this.purchaseMapper = purchaseMapper;
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
        return purchaseMapper.toResponse(savedPurchase);
    }

    @Override
    public PurchaseResponse uploadInvoice(Long purchaseId, MultipartFile file) {
        Purchase purchase = purchaseRepository.findById(purchaseId)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase not found with id: " + purchaseId));
        String path = fileStorageService.storeInvoice(file);
        purchase.setInvoiceFilePath(path);
        purchase.setInvoiceFileOriginalName(file.getOriginalFilename());
        purchase.setInvoiceFileStoredName(path);
        purchase.setInvoiceProcessingStatus(com.company.inventory.entity.InvoiceProcessingStatus.PROCESSING);
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
