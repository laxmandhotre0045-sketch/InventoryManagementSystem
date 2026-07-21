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

import com.company.inventory.dto.request.ComponentRequest;
import com.company.inventory.dto.response.ComponentResponse;
import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.entity.ComponentItem;
import com.company.inventory.entity.ComponentStatus;
import com.company.inventory.exception.ResourceNotFoundException;
import com.company.inventory.mapper.ComponentMapper;
import com.company.inventory.repository.ComponentRepository;
import com.company.inventory.repository.InventoryTransactionRepository;
import com.company.inventory.repository.ProjectComponentUsageRepository;
import com.company.inventory.repository.PurchaseItemRepository;
import com.company.inventory.service.ComponentService;

@Service
@Transactional
public class ComponentServiceImpl implements ComponentService {

    private final ComponentRepository componentRepository;
    private final ComponentMapper componentMapper;
    private final InventoryTransactionRepository transactionRepository;
    private final PurchaseItemRepository purchaseItemRepository;
    private final ProjectComponentUsageRepository projectComponentUsageRepository;

    public ComponentServiceImpl(ComponentRepository componentRepository, ComponentMapper componentMapper,
                                InventoryTransactionRepository transactionRepository,
                                PurchaseItemRepository purchaseItemRepository,
                                ProjectComponentUsageRepository projectComponentUsageRepository) {
        this.componentRepository = componentRepository;
        this.componentMapper = componentMapper;
        this.transactionRepository = transactionRepository;
        this.purchaseItemRepository = purchaseItemRepository;
        this.projectComponentUsageRepository = projectComponentUsageRepository;
    }

    @Override
    public ComponentResponse createComponent(ComponentRequest request) {
        componentRepository.findByComponentName(request.getComponentName())
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("Component name must be unique");
                });

        ComponentItem entity = componentMapper.toEntity(request);
        ComponentItem saved = componentRepository.save(entity);
        return componentMapper.toResponse(saved);
    }

    @Override
    public ComponentResponse updateComponent(Long id, ComponentRequest request) {
        ComponentItem existing = componentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Component not found with id: " + id));

        componentRepository.findByComponentName(request.getComponentName())
                .filter(component -> !component.getId().equals(id))
                .ifPresent(component -> {
                    throw new IllegalArgumentException("Component name must be unique");
                });

        componentMapper.updateEntity(request, existing);
        ComponentItem updated = componentRepository.save(existing);
        return componentMapper.toResponse(updated);
    }

    @Override
    public void deleteComponent(Long id) {
        ComponentItem existing = componentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Component not found with id: " + id));
        existing.setStatus(ComponentStatus.ARCHIVED);
        componentRepository.save(existing);
    }

    @Override
    public void restoreComponent(Long id) {
        ComponentItem existing = componentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Component not found with id: " + id));
        existing.setStatus(ComponentStatus.ACTIVE);
        componentRepository.save(existing);
    }

    @Override
    public ComponentResponse getComponentById(Long id) {
        ComponentItem existing = componentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Component not found with id: " + id));
        return componentMapper.toResponse(existing);
    }

    @Override
    public PagedResponse<ComponentResponse> getAllComponents(int page, int size, String sortBy, String sortDir,
                                                               String keyword, String category, String status, String stockStatus) {
        return searchComponents(keyword, category, status, stockStatus, page, size, sortBy, sortDir);
    }

    @Override
    public PagedResponse<ComponentResponse> searchComponents(String keyword, String category, String status, String stockStatus,
                                                              int page, int size, String sortBy, String sortDir) {
        Pageable pageable = createPageable(page, size, sortBy, sortDir);
        Specification<ComponentItem> spec = buildComponentSpecification(keyword, category, status, stockStatus);
        Page<ComponentItem> componentPage = componentRepository.findAll(spec, pageable);
        return mapPage(componentPage);
    }

    @Override
    public List<ComponentResponse> getLowStockComponents() {
        return componentRepository.findLowStock().stream()
                .map(componentMapper::toResponse)
                .collect(Collectors.toList());
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

    private PagedResponse<ComponentResponse> mapPage(Page<ComponentItem> pageData) {
        List<ComponentResponse> responses = pageData.getContent().stream()
                .map(componentMapper::toResponse)
                .collect(Collectors.toList());

        PagedResponse<ComponentResponse> response = new PagedResponse<>();
        response.setContent(responses);
        response.setPage(pageData.getNumber());
        response.setSize(pageData.getSize());
        response.setTotalElements(pageData.getTotalElements());
        response.setTotalPages(pageData.getTotalPages());
        response.setLast(pageData.isLast());
        return response;
    }

    private Specification<ComponentItem> buildComponentSpecification(String keyword, String category, String status, String stockStatus) {
        return (root, query, cb) -> {
        	List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();

            if (keyword != null && !keyword.isBlank()) {
                String pattern = "%" + keyword.toLowerCase().trim() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("componentName")), pattern),
                        cb.like(cb.lower(root.get("category")), pattern)
                ));
            }

            if (category != null && !category.isBlank()) {
                predicates.add(cb.equal(root.get("category"), category));
            }

            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(root.get("status"), ComponentStatus.valueOf(status)));
            } else {
                predicates.add(cb.notEqual(root.get("status"), ComponentStatus.ARCHIVED));
            }

            if (stockStatus != null && !stockStatus.isBlank()) {
                switch (stockStatus) {
                    case "AVAILABLE":
                        predicates.add(cb.greaterThan(root.get("quantity"), root.get("minimumQuantity")));
                        break;
                    case "LOW_STOCK":
                        predicates.add(cb.and(
                                cb.greaterThan(root.get("quantity"), 0),
                                cb.lessThanOrEqualTo(root.get("quantity"), root.get("minimumQuantity"))
                        ));
                        break;
                    case "OUT_OF_STOCK":
                        predicates.add(cb.equal(root.get("quantity"), 0));
                        break;
                    default:
                        break;
                }
            }

            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }
}
