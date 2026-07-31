package com.company.inventory.service;

import org.springframework.web.multipart.MultipartFile;

import com.company.inventory.dto.response.ExtractInvoiceResponse;

public interface InvoiceExtractionService {

    /**
     * Store an uploaded invoice, run it through the active extraction provider,
     * persist the result, and return the structured (editable) data plus the
     * stored file reference.
     */
    ExtractInvoiceResponse extractInvoice(MultipartFile file, String username);

    /** Link an extraction to a created purchase and mark it CONFIRMED. No-op if id is null/absent. */
    void markConfirmed(Long extractionId, Long purchaseId);
}
