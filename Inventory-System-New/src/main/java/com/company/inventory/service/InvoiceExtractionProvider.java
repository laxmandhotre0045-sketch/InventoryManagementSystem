package com.company.inventory.service;

import com.company.inventory.dto.response.ExtractedInvoice;

/**
 * Pluggable OCR / document-intelligence provider.
 *
 * The rest of the application depends ONLY on this interface, never on any
 * concrete OCR implementation. To integrate a real service, the AI/ML team adds
 * a new {@code @Service} implementing this interface and activates it via the
 * {@code app.invoice.ocr.provider} property — no controller, service, database
 * or frontend change is required.
 *
 * Suggested activation pattern for a real provider:
 * <pre>
 *   &#64;Service
 *   &#64;ConditionalOnProperty(prefix = "app.invoice.ocr", name = "provider", havingValue = "google")
 *   public class GoogleVisionInvoiceProvider implements InvoiceExtractionProvider { ... }
 * </pre>
 */
public interface InvoiceExtractionProvider {

    /** Short identifier of this provider, e.g. "mock", "google", "azure", "textract". */
    String name();

    /** True while extraction is simulated (used by the UI to show a "sample data" hint). */
    boolean isMock();

    /**
     * Extract structured data from a raw invoice document.
     *
     * @param content         raw bytes of the uploaded file
     * @param contentType     MIME type (application/pdf, image/png, ...)
     * @param originalFilename original upload name (may be null)
     */
    ExtractedInvoice extract(byte[] content, String contentType, String originalFilename);
}
