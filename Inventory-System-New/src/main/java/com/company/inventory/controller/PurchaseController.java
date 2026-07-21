package com.company.inventory.controller;

import com.company.inventory.dto.request.PurchaseRequest;
import com.company.inventory.dto.response.ApiResponse;
import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.dto.response.PurchaseResponse;
import com.company.inventory.dto.response.PurchaseSummaryResponse;
import com.company.inventory.service.PurchaseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/purchases")
@Validated
@Tag(name = "Purchase Management", description = "Track component purchases and upload invoices")
public class PurchaseController {

    private final PurchaseService purchaseService;

    public PurchaseController(PurchaseService purchaseService) {
        this.purchaseService = purchaseService;
    }

    @Operation(summary = "Create a purchase record")
    @PostMapping
    public ResponseEntity<ApiResponse<PurchaseResponse>> createPurchase(
            @Valid @RequestBody PurchaseRequest request,
            Authentication authentication) {
        String username = authentication != null ? authentication.getName() : "SYSTEM";
        PurchaseResponse response = purchaseService.createPurchase(request, username);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Purchase created successfully", response));
    }

    @Operation(summary = "Upload invoice for purchase")
    @PostMapping("/{id}/upload-invoice")
    public ResponseEntity<ApiResponse<PurchaseResponse>> uploadInvoice(
            @Parameter(description = "Purchase identifier", required = true) @PathVariable Long id,
            @RequestParam("file") MultipartFile file) {
        PurchaseResponse response = purchaseService.uploadInvoice(id, file);
        return ResponseEntity.ok(ApiResponse.success("Invoice uploaded successfully", response));
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
