package com.company.inventory.service;

import com.company.inventory.dto.request.EquipmentRequest;
import com.company.inventory.dto.response.EquipmentResponse;
import com.company.inventory.dto.response.PagedResponse;

public interface EquipmentService {

    EquipmentResponse createEquipment(EquipmentRequest request);

    EquipmentResponse updateEquipment(Long id, EquipmentRequest request);

    void deleteEquipment(Long id);

    EquipmentResponse getEquipmentById(Long id);

    PagedResponse<EquipmentResponse> getAllEquipment(String keyword, String category, String status,
                                                      int page, int size, String sortBy, String sortDir);

    PagedResponse<EquipmentResponse> searchEquipment(String keyword, String category, String status,
                                                      int page, int size, String sortBy, String sortDir);
}
