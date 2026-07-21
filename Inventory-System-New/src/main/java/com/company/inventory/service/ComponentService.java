package com.company.inventory.service;

import java.util.List;

import com.company.inventory.dto.request.ComponentRequest;
import com.company.inventory.dto.response.ComponentResponse;
import com.company.inventory.dto.response.PagedResponse;

public interface ComponentService {

    ComponentResponse createComponent(ComponentRequest request);

    ComponentResponse updateComponent(Long id, ComponentRequest request);

    void deleteComponent(Long id);

    ComponentResponse getComponentById(Long id);

    PagedResponse<ComponentResponse> getAllComponents(int page, int size, String sortBy, String sortDir,
                                                           String keyword, String category, String status, String stockStatus);

    PagedResponse<ComponentResponse> searchComponents(String keyword, String category, String status, String stockStatus,
                                                      int page, int size, String sortBy, String sortDir);

    void restoreComponent(Long id);

    List<ComponentResponse> getLowStockComponents();
}
