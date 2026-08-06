package com.company.inventory.service;

import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

public interface FileStorageService {

    String storeInvoice(MultipartFile file);

    /**
     * Loads a previously stored invoice for viewing or download.
     *
     * @param storedPath the value persisted on the purchase (e.g. {@code uploads/invoices/<uuid>.pdf})
     * @throws com.company.inventory.exception.ResourceNotFoundException if the file is missing
     * @throws IllegalArgumentException if the path escapes the invoice directory
     */
    Resource loadInvoice(String storedPath);

    /** Best-effort MIME type for a stored invoice, used to set Content-Type on the response. */
    String contentTypeOf(String storedPath);
}
