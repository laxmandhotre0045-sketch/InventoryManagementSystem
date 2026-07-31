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
}
