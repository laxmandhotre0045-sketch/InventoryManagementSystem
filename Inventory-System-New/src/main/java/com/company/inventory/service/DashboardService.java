package com.company.inventory.service;

import com.company.inventory.dto.response.DashboardSummaryResponse;
import com.company.inventory.dto.response.LowStockResponse;
import com.company.inventory.dto.response.ProjectSummaryResponse;
import com.company.inventory.dto.response.RecentPurchaseResponse;
import com.company.inventory.dto.response.RecentTransactionResponse;

import java.util.List;

public interface DashboardService {

    DashboardSummaryResponse getDashboardSummary();

    List<LowStockResponse> getLowStockComponents();

    List<RecentPurchaseResponse> getRecentPurchases(int limit);

    List<RecentTransactionResponse> getRecentTransactions(int limit);

    List<ProjectSummaryResponse> getProjectSummary();
}
