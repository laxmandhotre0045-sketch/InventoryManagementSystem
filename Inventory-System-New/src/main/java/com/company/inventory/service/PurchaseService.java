package com.company.inventory.service;

import com.company.inventory.dto.request.PurchaseRequest;
import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.dto.response.PurchaseResponse;
import com.company.inventory.dto.response.PurchaseSummaryResponse;
import org.springframework.web.multipart.MultipartFile;

public interface PurchaseService {

    PurchaseResponse createPurchase(PurchaseRequest request, String username);

    /**
     * Transactionally finalise a reviewed invoice: create any approved new
     * components/equipment, create the purchase from the component lines,
     * stock-in and log transactions, and link the invoice. All-or-nothing.
     */
    PurchaseResponse confirmInvoicePurchase(com.company.inventory.dto.request.ConfirmInvoiceRequest request, String username);

    PurchaseResponse uploadInvoice(Long purchaseId, MultipartFile file);

    PurchaseResponse getPurchaseById(Long id);

    PagedResponse<PurchaseResponse> getAllPurchases(int page, int size, String sortBy, String sortDir);

    PagedResponse<PurchaseResponse> searchPurchases(String keyword, int page, int size, String sortBy, String sortDir);

    void deletePurchase(Long id);

    PurchaseSummaryResponse getPurchaseSummary(Long id);
}
