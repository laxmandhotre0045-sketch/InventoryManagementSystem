package com.company.inventory.dto.response;

import java.math.BigDecimal;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * One extracted line from an invoice. All fields are what an OCR/document-AI
 * service is expected to return; every value is user-editable in the UI before
 * the purchase is confirmed.
 */
@Data
public class ExtractedInvoiceLineItem {

    @Schema(description = "Item name / description as printed on the invoice", example = "TPS61023DRLR Boost DC-DC Converter")
    private String description;

    @Schema(description = "Supplier's part / catalogue code, e.g. [R216425]", example = "R216425")
    private String supplierItemCode;

    @Schema(description = "HSN / SAC tax classification code", example = "85423100")
    private String hsnCode;

    @Schema(description = "Category (best guess)", example = "DC-DC Converters")
    private String category;

    @Schema(description = "Quantity", example = "50")
    private BigDecimal quantity;

    @Schema(description = "Unit of measure", example = "pcs")
    private String unit;

    @Schema(description = "Unit price", example = "8.20")
    private BigDecimal unitPrice;

    @Schema(description = "Discount amount on the line", example = "0.00")
    private BigDecimal discount;

    @Schema(description = "Tax percentage applied", example = "18.0")
    private BigDecimal taxPercentage;

    @Schema(description = "Tax amount for the line", example = "73.80")
    private BigDecimal taxAmount;

    @Schema(description = "Line total (qty x price - discount + tax)", example = "483.80")
    private BigDecimal lineTotal;

    // ---- Populated by the (future) intelligent mapping, mock leaves as hints ----

    @Schema(description = "Suggested item type when this is a new item: COMPONENT or EQUIPMENT", example = "COMPONENT")
    private String suggestedType;

    // ---- From the AI: physical form, when the invoice implies it ----

    @Schema(description = "Package / footprint, e.g. 0805, SOT-23, DIP-8", example = "0805")
    private String packageName;

    @Schema(description = "SMD or THT, as judged by the AI", example = "SMD")
    private String mounting;

    // ---- Where a NEW item would be filed: Category › Type › Value (auto-suggested) ----

    @Schema(description = "Suggested existing category id (null when a new category is suggested)")
    private Long inventoryCategoryId;

    @Schema(description = "Suggested category", example = "Capacitor")
    private String inventoryCategory;

    @Schema(description = "True when the suggested category does not exist yet")
    private boolean inventoryCategoryIsNew;

    @Schema(description = "Suggested type: SMD, THT or Module", example = "SMD")
    private String inventoryType;

    @Schema(description = "Suggested value", example = "100nF")
    private String inventoryValue;

    @Schema(description = "Category › Type › Value", example = "Capacitor › SMD › 100nF")
    private String inventoryPath;

    @Schema(description = "Why this category was suggested")
    private String inventoryReason;

    // ---- Same part already in stock? (set by the server, confirmed by the user) ----

    @Schema(description = "Existing component this line is (or may be) the same part as")
    private Long matchedComponentId;

    @Schema(description = "Name of that existing component", example = "RES 4K7 0603 1%")
    private String matchedComponentName;

    @Schema(description = "Its current stock")
    private Integer matchedComponentStock;

    @Schema(description = "SURE: pre-selected as 'add to existing'. POSSIBLE: suggested, user decides.",
            example = "SURE")
    private String matchConfidence;

    @Schema(description = "What to check when the match is only POSSIBLE")
    private String matchNote;
}
