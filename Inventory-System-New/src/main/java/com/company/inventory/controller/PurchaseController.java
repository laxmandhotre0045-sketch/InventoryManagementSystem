package com.company.inventory.controller;

import com.company.inventory.dto.request.PurchaseRequest;
import com.company.inventory.dto.request.ConfirmInvoiceRequest;
import com.company.inventory.dto.response.ApiResponse;
import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.dto.response.PurchaseResponse;
import com.company.inventory.dto.response.PurchaseSummaryResponse;
import com.company.inventory.dto.response.ExtractInvoiceResponse;
import com.company.inventory.service.PurchaseService;
import com.company.inventory.service.InvoiceExtractionService;
import com.company.inventory.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/purchases")
@Validated
@Tag(name = "Purchase Management", description = "Track component purchases and upload invoices")
public class PurchaseController {

    private final PurchaseService purchaseService;
    private final InvoiceExtractionService invoiceExtractionService;
    private final NotificationService notificationService;

    public PurchaseController(PurchaseService purchaseService,
                             InvoiceExtractionService invoiceExtractionService,
                             NotificationService notificationService) {
        this.purchaseService = purchaseService;
        this.invoiceExtractionService = invoiceExtractionService;
        this.notificationService = notificationService;
    }

    @Operation(summary = "Upload an invoice and get structured (mock) extracted data",
            description = "Stores the invoice and returns editable structured data from the active OCR provider. "
                    + "The provider is pluggable — the mock is replaced later without changing this endpoint.")
    @PostMapping(value = "/extract-invoice", consumes = "multipart/form-data")
    public ResponseEntity<ApiResponse<ExtractInvoiceResponse>> extractInvoice(
            @RequestParam("file") MultipartFile file,
            Authentication authentication) {
        String username = authentication != null ? authentication.getName() : "SYSTEM";
        ExtractInvoiceResponse response = invoiceExtractionService.extractInvoice(file, username);
        return ResponseEntity.ok(ApiResponse.success("Invoice extracted successfully", response));
    }

    @Operation(summary = "Confirm a reviewed invoice and create the purchase atomically",
            description = "Creates any approved new components/equipment, the purchase, stock-in and "
                    + "transactions, and links the invoice — all in one transaction (all-or-nothing).")
    @PostMapping("/confirm-invoice")
    public ResponseEntity<ApiResponse<PurchaseResponse>> confirmInvoice(
            @Valid @RequestBody ConfirmInvoiceRequest request,
            Authentication authentication) {
        String username = authentication != null ? authentication.getName() : "SYSTEM";
        PurchaseResponse response = purchaseService.confirmInvoicePurchase(request, username);
        notificationService.notifyPurchaseCreated(response.getId(), response.getInvoiceNumber(), response.getSupplierName());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Purchase created from invoice", response));
    }

    @Operation(summary = "Create a purchase record")
    @PostMapping
    public ResponseEntity<ApiResponse<PurchaseResponse>> createPurchase(
            @Valid @RequestBody PurchaseRequest request,
            Authentication authentication) {
        String username = authentication != null ? authentication.getName() : "SYSTEM";
        PurchaseResponse response = purchaseService.createPurchase(request, username);
        notificationService.notifyPurchaseCreated(response.getId(), response.getInvoiceNumber(), response.getSupplierName());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Purchase created successfully", response));
    }

    @Operation(summary = "Upload invoice for purchase")
    @PostMapping("/{id}/upload-invoice")
    public ResponseEntity<ApiResponse<PurchaseResponse>> uploadInvoice(
            @Parameter(description = "Purchase identifier", required = true) @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            Authentication authentication) {
        String username = authentication != null ? authentication.getName() : "SYSTEM";
        PurchaseResponse response = purchaseService.uploadInvoice(id, file, username);
        return ResponseEntity.ok(ApiResponse.success("Invoice uploaded successfully", response));
    }

    /**
     * Streams a stored invoice back for viewing or download.
     *
     * <p>{@code inline} renders in the browser's PDF/image viewer; {@code attachment}
     * forces a save. The bytes are served through this authenticated endpoint rather
     * than from a static directory, so invoices are not publicly reachable by URL.</p>
     */
    @Operation(summary = "View or download the stored invoice document")
    @GetMapping("/{id}/invoice")
    public ResponseEntity<Resource> getInvoiceFile(
            @Parameter(description = "Purchase identifier", required = true) @PathVariable Long id,
            @Parameter(description = "Set true to force a download instead of inline display")
            @RequestParam(defaultValue = "false") boolean download) {

        PurchaseResponse purchase = purchaseService.getPurchaseById(id);
        Resource resource = purchaseService.loadInvoiceFile(id);

        String contentType = purchaseService.invoiceContentType(id);
        String filename = purchase.getInvoiceFileOriginalName() != null
                ? purchase.getInvoiceFileOriginalName()
                : "invoice-" + purchase.getInvoiceNumber();
        // RFC 5987 so non-ASCII invoice names survive the header.
        String encoded = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");
        String disposition = (download ? "attachment" : "inline")
                + "; filename=\"" + filename.replaceAll("[\"\\r\\n]", "") + "\""
                + "; filename*=UTF-8''" + encoded;

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=0, must-revalidate")
                .body(resource);
    }

    @Operation(summary = "Get purchase by id")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<PurchaseResponse>> getPurchaseById(
            @Parameter(description = "Purchase identifier", required = true) @PathVariable Long id) {
        PurchaseResponse response = purchaseService.getPurchaseById(id);
        return ResponseEntity.ok(ApiResponse.success("Purchase retrieved successfully", response));
    }

    @Operation(summary = "Get paged purchase list")
    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<PurchaseResponse>>> getAllPurchases(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "purchaseDate") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        PagedResponse<PurchaseResponse> response = purchaseService.getAllPurchases(page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success("Purchases retrieved successfully", response));
    }

    @Operation(summary = "Search purchases by supplier or invoice")
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<PagedResponse<PurchaseResponse>>> searchPurchases(
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "purchaseDate") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        PagedResponse<PurchaseResponse> response = purchaseService.searchPurchases(keyword, page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success("Purchase search completed successfully", response));
    }

    @Operation(summary = "Delete a purchase")
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deletePurchase(
            @Parameter(description = "Purchase identifier", required = true) @PathVariable Long id) {
        purchaseService.deletePurchase(id);
        return ResponseEntity.ok(ApiResponse.success("Purchase deleted successfully", null));
    }

    @Operation(summary = "Get purchase summary")
    @GetMapping("/{id}/summary")
    public ResponseEntity<ApiResponse<PurchaseSummaryResponse>> getPurchaseSummary(
            @Parameter(description = "Purchase identifier", required = true) @PathVariable Long id) {
        PurchaseSummaryResponse response = purchaseService.getPurchaseSummary(id);
        return ResponseEntity.ok(ApiResponse.success("Purchase summary retrieved successfully", response));
    }
}
