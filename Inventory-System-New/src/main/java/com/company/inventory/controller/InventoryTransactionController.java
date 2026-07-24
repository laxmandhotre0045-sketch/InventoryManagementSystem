package com.company.inventory.controller;

import com.company.inventory.dto.request.StockInRequest;
import com.company.inventory.dto.request.StockOutRequest;
import com.company.inventory.dto.response.ApiResponse;
import com.company.inventory.dto.response.InventoryTransactionResponse;
import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.service.InventoryTransactionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/inventory")
@Tag(name = "Inventory Transactions", description = "Track inventory movements and stock transactions")
public class InventoryTransactionController {

    private final InventoryTransactionService transactionService;

    public InventoryTransactionController(InventoryTransactionService transactionService) {
        this.transactionService = transactionService;
    }

    @Operation(summary = "Add stock (Stock In)")
    @PostMapping("/stock-in")
    public ResponseEntity<ApiResponse<InventoryTransactionResponse>> stockIn(
            @Valid @RequestBody StockInRequest request,
            Authentication authentication) {
        String username = authentication != null ? authentication.getName() : "SYSTEM";
        InventoryTransactionResponse response = transactionService.stockIn(request, username);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Stock added successfully", response));
    }

    @Operation(summary = "Remove stock (Stock Out)")
    @PostMapping("/stock-out")
    public ResponseEntity<ApiResponse<InventoryTransactionResponse>> stockOut(
            @Valid @RequestBody StockOutRequest request,
            Authentication authentication) {
        String username = authentication != null ? authentication.getName() : "SYSTEM";
        InventoryTransactionResponse response = transactionService.stockOut(request, username);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Stock removed successfully", response));
    }

    @Operation(summary = "Get transaction by id")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<InventoryTransactionResponse>> getTransaction(
            @Parameter(description = "Transaction identifier", required = true) @PathVariable Long id) {
        InventoryTransactionResponse response = transactionService.getTransactionById(id);
        return ResponseEntity.ok(ApiResponse.success("Transaction retrieved successfully", response));
    }

    @Operation(summary = "Get all transaction history")
    @GetMapping("/history")
    public ResponseEntity<ApiResponse<PagedResponse<InventoryTransactionResponse>>> getHistory(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "transactionDate") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        PagedResponse<InventoryTransactionResponse> response = transactionService.getTransactionHistory(page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success("Transaction history retrieved successfully", response));
    }

    @Operation(summary = "Get component transaction history")
    @GetMapping("/history/{componentId}")
    public ResponseEntity<ApiResponse<PagedResponse<InventoryTransactionResponse>>> getComponentHistory(
            @Parameter(description = "Component identifier", required = true) @PathVariable Long componentId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "transactionDate") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        PagedResponse<InventoryTransactionResponse> response = transactionService.getComponentTransactionHistory(componentId, page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success("Component transaction history retrieved successfully", response));
    }
}
