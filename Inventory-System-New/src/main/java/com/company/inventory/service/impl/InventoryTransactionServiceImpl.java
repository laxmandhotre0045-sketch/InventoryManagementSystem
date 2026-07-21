package com.company.inventory.service.impl;

import com.company.inventory.dto.request.StockInRequest;
import com.company.inventory.dto.request.StockOutRequest;
import com.company.inventory.dto.response.InventoryTransactionResponse;
import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.entity.ComponentItem;
import com.company.inventory.entity.InventoryTransaction;
import com.company.inventory.entity.TransactionType;
import com.company.inventory.exception.InsufficientStockException;
import com.company.inventory.exception.ResourceNotFoundException;
import com.company.inventory.mapper.InventoryTransactionMapper;
import com.company.inventory.repository.ComponentRepository;
import com.company.inventory.repository.InventoryTransactionRepository;
import com.company.inventory.service.InventoryTransactionService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class InventoryTransactionServiceImpl implements InventoryTransactionService {

    private final InventoryTransactionRepository transactionRepository;
    private final ComponentRepository componentRepository;
    private final InventoryTransactionMapper transactionMapper;

    public InventoryTransactionServiceImpl(InventoryTransactionRepository transactionRepository,
                                          ComponentRepository componentRepository,
                                          InventoryTransactionMapper transactionMapper) {
        this.transactionRepository = transactionRepository;
        this.componentRepository = componentRepository;
        this.transactionMapper = transactionMapper;
    }

    @Override
    public InventoryTransactionResponse stockIn(StockInRequest request, String username) {
        ComponentItem component = componentRepository.findById(request.getComponentId())
                .orElseThrow(() -> new ResourceNotFoundException("Component not found with id: " + request.getComponentId()));

        // Increase component quantity
        component.setQuantity(component.getQuantity() + request.getQuantity());
        componentRepository.save(component);

        // Record transaction
        InventoryTransaction transaction = InventoryTransaction.builder()
                .component(component)
                .transactionType(TransactionType.STOCK_IN)
                .quantity(request.getQuantity())
                .remarks(request.getRemarks())
                .createdBy(username)
                .build();

        InventoryTransaction saved = transactionRepository.save(transaction);
        return transactionMapper.toResponse(saved);
    }

    @Override
    public InventoryTransactionResponse stockOut(StockOutRequest request, String username) {
        ComponentItem component = componentRepository.findById(request.getComponentId())
                .orElseThrow(() -> new ResourceNotFoundException("Component not found with id: " + request.getComponentId()));

        // Validate sufficient stock
        if (component.getQuantity() < request.getQuantity()) {
            throw new InsufficientStockException(
                    String.format("Insufficient stock available. Current: %d, Requested: %d",
                            component.getQuantity(), request.getQuantity()));
        }

        // Decrease component quantity
        component.setQuantity(component.getQuantity() - request.getQuantity());
        componentRepository.save(component);

        // Record transaction
        InventoryTransaction transaction = InventoryTransaction.builder()
                .component(component)
                .transactionType(TransactionType.STOCK_OUT)
                .quantity(request.getQuantity())
                .remarks(request.getRemarks())
                .createdBy(username)
                .build();

        InventoryTransaction saved = transactionRepository.save(transaction);
        return transactionMapper.toResponse(saved);
    }

    @Override
    public InventoryTransactionResponse getTransactionById(Long id) {
        InventoryTransaction transaction = transactionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction not found with id: " + id));
        return transactionMapper.toResponse(transaction);
    }

    @Override
    public PagedResponse<InventoryTransactionResponse> getTransactionHistory(int page, int size, String sortBy, String sortDir) {
        Pageable pageable = createPageable(page, size, sortBy, sortDir);
        Page<InventoryTransaction> transactionPage = transactionRepository.findAllByOrderByTransactionDateDesc(pageable);
        return mapPage(transactionPage);
    }

    @Override
    public PagedResponse<InventoryTransactionResponse> getComponentTransactionHistory(Long componentId, int page, int size, String sortBy, String sortDir) {
        // Verify component exists
        componentRepository.findById(componentId)
                .orElseThrow(() -> new ResourceNotFoundException("Component not found with id: " + componentId));

        Pageable pageable = createPageable(page, size, sortBy, sortDir);
        Page<InventoryTransaction> transactionPage = transactionRepository.findByComponentId(componentId, pageable);
        return mapPage(transactionPage);
    }

    private Pageable createPageable(int page, int size, String sortBy, String sortDir) {
        Sort sort = Sort.by(sortBy);
        if ("desc".equalsIgnoreCase(sortDir)) {
            sort = sort.descending();
        } else {
            sort = sort.ascending();
        }
        return PageRequest.of(page, size, sort);
    }

    private PagedResponse<InventoryTransactionResponse> mapPage(Page<InventoryTransaction> pageData) {
        List<InventoryTransactionResponse> responses = pageData.getContent().stream()
                .map(transactionMapper::toResponse)
                .collect(Collectors.toList());

        PagedResponse<InventoryTransactionResponse> response = new PagedResponse<>();
        response.setContent(responses);
        response.setPage(pageData.getNumber());
        response.setSize(pageData.getSize());
        response.setTotalElements(pageData.getTotalElements());
        response.setTotalPages(pageData.getTotalPages());
        response.setLast(pageData.isLast());
        return response;
    }
}
