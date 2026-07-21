package com.company.inventory.service;

import com.company.inventory.dto.request.StockInRequest;
import com.company.inventory.dto.request.StockOutRequest;
import com.company.inventory.dto.response.InventoryTransactionResponse;
import com.company.inventory.dto.response.PagedResponse;

public interface InventoryTransactionService {

    InventoryTransactionResponse stockIn(StockInRequest request, String username);

    InventoryTransactionResponse stockOut(StockOutRequest request, String username);

    InventoryTransactionResponse getTransactionById(Long id);

    PagedResponse<InventoryTransactionResponse> getTransactionHistory(int page, int size, String sortBy, String sortDir);

    PagedResponse<InventoryTransactionResponse> getComponentTransactionHistory(Long componentId, int page, int size, String sortBy, String sortDir);
}
