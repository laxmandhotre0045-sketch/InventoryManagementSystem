package com.company.inventory.dto.request;

import java.time.LocalDate;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * The complete, user-reviewed invoice submitted from the review screen.
 * Everything it triggers (create items, create purchase, stock-in,
 * transactions, invoice linking) is executed in a single transaction.
 */
@Data
public class ConfirmInvoiceRequest {

    @io.swagger.v3.oas.annotations.media.Schema(description = "When set, the purchase is made for this project: "
            + "every component line also goes into the project's folder at the price paid, unless the line "
            + "names another project folder (or general stock)")
    private Long projectId;

    @Schema(description = "Extraction record id from /extract-invoice")
    private Long extractionId;

    @Schema(description = "Stored invoice path from /extract-invoice")
    @Size(max = 255)
    private String invoiceFilePath;

    @NotBlank(message = "Supplier name is required")
    @Size(max = 150)
    private String supplierName;

    @NotBlank(message = "Invoice number is required")
    @Size(max = 120)
    private String invoiceNumber;

    private LocalDate purchaseDate;

    @Size(max = 1000)
    private String remarks;

    @NotEmpty(message = "At least one reviewed line is required")
    @Valid
    private List<ConfirmInvoiceItemRequest> items;
}
