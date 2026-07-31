package com.company.inventory.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * Response of POST /purchases/extract-invoice.
 *
 * The uploaded file has already been stored; {@code invoiceFilePath} is passed
 * back so it can be linked to the purchase on confirmation. {@code extractionId}
 * lets the confirm step mark the extraction as used.
 */
@Data
public class ExtractInvoiceResponse {

    @Schema(description = "Persisted extraction record id", example = "42")
    private Long extractionId;

    @Schema(description = "Stored invoice path to attach to the purchase", example = "uploads/invoices/ab12.pdf")
    private String invoiceFilePath;

    @Schema(description = "Original uploaded filename", example = "invoice-tdk-0417.pdf")
    private String originalFilename;

    @Schema(description = "Provider that produced the extraction", example = "mock")
    private String provider;

    @Schema(description = "True while the extraction is simulated (no real OCR yet)", example = "true")
    private boolean mock;

    @Schema(description = "Structured, editable invoice data")
    private ExtractedInvoice extracted;
}
