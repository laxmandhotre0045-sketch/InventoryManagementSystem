package com.company.inventory.service.impl;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.company.inventory.dto.request.EquipmentRequest;
import com.company.inventory.dto.response.EquipmentResponse;
import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.entity.Equipment;
import com.company.inventory.exception.ResourceNotFoundException;
import com.company.inventory.mapper.EquipmentMapper;
import com.company.inventory.repository.EquipmentRepository;
import com.company.inventory.service.EquipmentService;
@Service
@Transactional
public class EquipmentServiceImpl implements EquipmentService {

    private final EquipmentRepository equipmentRepository;
    private final EquipmentMapper equipmentMapper;

    public EquipmentServiceImpl(EquipmentRepository equipmentRepository, EquipmentMapper equipmentMapper) {
        this.equipmentRepository = equipmentRepository;
        this.equipmentMapper = equipmentMapper;
    }

    @Override
    public EquipmentResponse createEquipment(EquipmentRequest request) {
        Equipment equipment = equipmentMapper.toEntity(request);
        Equipment saved = equipmentRepository.save(equipment);
        return equipmentMapper.toResponse(saved);
    }

    @Override
    public EquipmentResponse updateEquipment(Long id, EquipmentRequest request) {
        Equipment equipment = equipmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Equipment not found with id: " + id));
        equipmentMapper.updateEntity(request, equipment);
        Equipment updated = equipmentRepository.save(equipment);
        return equipmentMapper.toResponse(updated);
    }

    @Override
    public void deleteEquipment(Long id) {
        Equipment equipment = equipmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Equipment not found with id: " + id));
        equipmentRepository.delete(equipment);
    }

    @Override
    public EquipmentResponse getEquipmentById(Long id) {
        Equipment equipment = equipmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Equipment not found with id: " + id));
        return equipmentMapper.toResponse(equipment);
    }

    @Override
    public PagedResponse<EquipmentResponse> getAllEquipment(String keyword, String category, String status,
                                                            int page, int size, String sortBy, String sortDir) {
        Pageable pageable = createPageable(page, size, sortBy, sortDir);
        Specification<Equipment> spec = buildEquipmentSpecification(keyword, category, status);
        Page<Equipment> equipmentPage = equipmentRepository.findAll(spec, pageable);
        return mapPage(equipmentPage);
    }

    @Override
    public PagedResponse<EquipmentResponse> searchEquipment(String keyword, String category, String status,
                                                            int page, int size, String sortBy, String sortDir) {
        Pageable pageable = createPageable(page, size, sortBy, sortDir);
        Specification<Equipment> spec = buildEquipmentSpecification(keyword, category, status);
        Page<Equipment> equipmentPage = equipmentRepository.findAll(spec, pageable);
        return mapPage(equipmentPage);
    }

    private Specification<Equipment> buildEquipmentSpecification(String keyword, String category, String status) {
        return (root, query, criteriaBuilder) -> {
        	List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();

            if (keyword != null && !keyword.isBlank()) {
                String pattern = "%" + keyword.toLowerCase().trim() + "%";
                predicates.add(criteriaBuilder.or(
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("name")), pattern),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("serialNumber")), pattern)
                ));
            }

            if (category != null && !category.isBlank()) {
                predicates.add(criteriaBuilder.equal(root.get("category"), category));
            }

            if (status != null && !status.isBlank()) {
                predicates.add(criteriaBuilder.equal(root.get("status"), status));
            }

            return criteriaBuilder.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
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

    private PagedResponse<EquipmentResponse> mapPage(Page<Equipment> equipmentPage) {
        List<EquipmentResponse> responses = equipmentPage.getContent().stream()
                .map(equipmentMapper::toResponse)
                .collect(Collectors.toList());

        PagedResponse<EquipmentResponse> pagedResponse = new PagedResponse<>();
        pagedResponse.setContent(responses);
        pagedResponse.setPage(equipmentPage.getNumber());
        pagedResponse.setSize(equipmentPage.getSize());
        pagedResponse.setTotalElements(equipmentPage.getTotalElements());
        pagedResponse.setTotalPages(equipmentPage.getTotalPages());
        pagedResponse.setLast(equipmentPage.isLast());
        return pagedResponse;
    }
}
