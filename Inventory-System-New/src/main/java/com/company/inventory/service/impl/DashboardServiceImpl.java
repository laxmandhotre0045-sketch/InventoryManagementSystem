package com.company.inventory.service.impl;

import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.company.inventory.dto.response.DashboardSummaryResponse;
import com.company.inventory.dto.response.LowStockResponse;
import com.company.inventory.dto.response.ProjectSummaryResponse;
import com.company.inventory.dto.response.RecentPurchaseResponse;
import com.company.inventory.dto.response.RecentTransactionResponse;
import com.company.inventory.entity.ComponentItem;
import com.company.inventory.entity.InventoryTransaction;
import com.company.inventory.entity.Project;
import com.company.inventory.entity.ProjectStatus;
import com.company.inventory.entity.Purchase;
import com.company.inventory.repository.ComponentRepository;
import com.company.inventory.repository.EquipmentRepository;
import com.company.inventory.repository.InventoryTransactionRepository;
import com.company.inventory.repository.ProjectComponentUsageRepository;
import com.company.inventory.repository.ProjectRepository;
import com.company.inventory.repository.PurchaseRepository;
import com.company.inventory.service.DashboardService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardServiceImpl implements DashboardService {

    private final EquipmentRepository equipmentRepository ;
    private final ComponentRepository componentRepository;
    private final ProjectRepository projectRepository;
    private final PurchaseRepository purchaseRepository;
    private final InventoryTransactionRepository transactionRepository;
    private final ProjectComponentUsageRepository projectComponentUsageRepository;

    @Override
    public DashboardSummaryResponse getDashboardSummary() {
        DashboardSummaryResponse response = new DashboardSummaryResponse();
        response.setTotalEquipment(equipmentRepository.count());
        response.setTotalComponents(componentRepository.countNonArchived());
        response.setTotalProjects(projectRepository.count());
        response.setActiveProjects(projectRepository.countByStatus(ProjectStatus.ACTIVE));
        response.setLowStockComponents(componentRepository.countLowStock());
        response.setTotalPurchases(purchaseRepository.count());
        response.setOutOfStockComponents(componentRepository.countOutOfStock());
        response.setTotalAvailableStock(componentRepository.sumTotalAvailableStock());
        response.setPurchasesThisMonth(purchaseRepository.countPurchasesThisMonth());
        // For total inventory value, it would require multiplying quantity by price if price existed, 
        // since it doesn't currently, we will default to 0 or leave it for future implementation.
        response.setTotalInventoryValue(0.0);
        
        return response;
    }

    @Override
    public List<LowStockResponse> getLowStockComponents() {
        return componentRepository.findLowStock().stream()
                .map(this::toLowStockResponse)
                .collect(Collectors.toList());
    }

    @Override
    public List<RecentPurchaseResponse> getRecentPurchases(int limit) {
        List<Purchase> purchases = purchaseRepository.findAll(PageRequest.of(0, Math.max(1, limit), Sort.by(Sort.Direction.DESC, "purchaseDate")))
                .getContent();
        if (purchases == null || purchases.isEmpty()) {
            return Collections.emptyList();
        }
        return purchases.stream()
                .map(this::toRecentPurchaseResponse)
                .collect(Collectors.toList());
    }

    @Override
    public List<RecentTransactionResponse> getRecentTransactions(int limit) {
        List<InventoryTransaction> transactions = transactionRepository.findAll(PageRequest.of(0, Math.max(1, limit), Sort.by(Sort.Direction.DESC, "transactionDate")))
                .getContent();
        if (transactions == null || transactions.isEmpty()) {
            return Collections.emptyList();
        }
        return transactions.stream()
                .map(this::toRecentTransactionResponse)
                .collect(Collectors.toList());
    }

    @Override
    public List<ProjectSummaryResponse> getProjectSummary() {
        List<Project> projects = projectRepository.findAll();
        if (projects == null || projects.isEmpty()) {
            return Collections.emptyList();
        }
        return projects.stream()
                .map(this::toProjectSummaryResponse)
                .sorted(Comparator.comparing(ProjectSummaryResponse::getProjectName))
                .collect(Collectors.toList());
    }

    private LowStockResponse toLowStockResponse(ComponentItem item) {
        LowStockResponse response = new LowStockResponse();
        response.setId(item.getId());
        response.setComponentName(item.getComponentName());
        response.setCategory(item.getCategory());
        response.setQuantity(item.getQuantity());
        response.setMinimumQuantity(item.getMinimumQuantity());
        return response;
    }

    private RecentPurchaseResponse toRecentPurchaseResponse(Purchase purchase) {
        RecentPurchaseResponse response = new RecentPurchaseResponse();
        response.setId(purchase.getId());
        response.setSupplierName(purchase.getSupplierName());
        response.setPurchaseDate(purchase.getPurchaseDate());
        response.setTotalAmount(purchase.getTotalAmount() != null ? purchase.getTotalAmount().doubleValue() : 0.0);
        return response;
    }

    private RecentTransactionResponse toRecentTransactionResponse(InventoryTransaction transaction) {
        RecentTransactionResponse response = new RecentTransactionResponse();
        response.setId(transaction.getId());
        response.setTransactionType(transaction.getTransactionType().name());
        response.setTransactionDate(transaction.getTransactionDate());
        response.setQuantity(transaction.getQuantity());
        response.setComponentName(transaction.getComponent() != null ? transaction.getComponent().getComponentName() : null);
        return response;
    }

    private ProjectSummaryResponse toProjectSummaryResponse(Project project) {
        ProjectSummaryResponse response = new ProjectSummaryResponse();
        response.setId(project.getId());
        response.setProjectName(project.getProjectName());
        response.setStatus(project.getStatus() != null ? project.getStatus().name() : null);
        response.setTotalComponentUsage(projectComponentUsageRepository.sumQuantityUsedByProjectId(project.getId()));
        return response;
    }
}
