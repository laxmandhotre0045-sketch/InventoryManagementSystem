package com.company.inventory.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * Structured invoice data returned by an {@code InvoiceExtractionProvider}.
 *
 * This is the contract the future OCR / document-intelligence service must
 * fulfil. The mock provider fills it with sample values; a real provider
 * (Google Vision, Azure Document Intelligence, AWS Textract, Tesseract, or a
 * custom model) returns the same shape — so nothing downstream changes.
 */
@Data
public class ExtractedInvoice {

    // ---- Document classification ----
    // Answered by the extractor before any field is read. A Boolean (not a boolean)
    // so "the provider never said" stays distinguishable from an explicit "no", and
    // so the JSON property keeps its "isInvoice" name.

    @Schema(description = "False when the uploaded file is not an invoice at all", example = "true")
    private Boolean isInvoice;

    @Schema(description = "What the document appears to be, when it is not an invoice",
            example = "a photograph of a circuit board")
    private String documentType;

    // ---- Supplier ----
    private String supplierName;
    private String supplierAddress;
    private String gstNumber;

    // ---- Invoice header ----
    private String invoiceNumber;
    private LocalDate invoiceDate;
    private String purchaseOrderNumber;
    private String currency;
    private String paymentTerms;
    private String placeOfSupply;

    // ---- Lines ----
    private List<ExtractedInvoiceLineItem> items = new ArrayList<>();

    // ---- Totals ----
    private BigDecimal subTotal;
    private BigDecimal discountTotal;
    private BigDecimal taxAmount;
    private BigDecimal shippingCharges;
    private BigDecimal otherCharges;
    private BigDecimal grandTotal;

    @Schema(description = "Final payable amount after tax, shipping and other charges")
    private BigDecimal finalInvoiceAmount;

    /**
     * Notes the extractor wants the reviewer to see — e.g. a figure two readings of the
     * document disagreed on. Not part of the AI's output contract; filled in by the
     * provider and folded into the response's warnings.
     */
    @Schema(description = "Extractor notes about figures that could not be read with confidence")
    private List<String> readingNotes = new ArrayList<>();
}
