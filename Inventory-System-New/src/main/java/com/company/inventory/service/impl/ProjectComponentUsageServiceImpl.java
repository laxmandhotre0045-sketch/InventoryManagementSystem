package com.company.inventory.service.impl;

import com.company.inventory.dto.request.ProjectUsageRequest;
import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.dto.response.ProjectUsageResponse;
import com.company.inventory.dto.response.ProjectUsageSummaryResponse;
import com.company.inventory.entity.ComponentItem;
import com.company.inventory.entity.InventoryTransaction;
import com.company.inventory.entity.Project;
import com.company.inventory.entity.ProjectComponentUsage;
import com.company.inventory.entity.TransactionType;
import com.company.inventory.exception.InsufficientStockException;
import com.company.inventory.exception.ResourceNotFoundException;
import com.company.inventory.mapper.ProjectComponentUsageMapper;
import com.company.inventory.repository.ComponentRepository;
import com.company.inventory.repository.InventoryTransactionRepository;
import com.company.inventory.repository.ProjectComponentUsageRepository;
import com.company.inventory.repository.ProjectRepository;
import com.company.inventory.service.ProjectComponentUsageService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional
public class ProjectComponentUsageServiceImpl implements ProjectComponentUsageService {

    private final ProjectComponentUsageRepository usageRepository;
    private final ProjectRepository projectRepository;
    private final ComponentRepository componentRepository;
    private final InventoryTransactionRepository transactionRepository;
    private final ProjectComponentUsageMapper usageMapper;

    public ProjectComponentUsageServiceImpl(ProjectComponentUsageRepository usageRepository,
                                            ProjectRepository projectRepository,
                                            ComponentRepository componentRepository,
                                            InventoryTransactionRepository transactionRepository,
                                            ProjectComponentUsageMapper usageMapper) {
        this.usageRepository = usageRepository;
        this.projectRepository = projectRepository;
        this.componentRepository = componentRepository;
        this.transactionRepository = transactionRepository;
        this.usageMapper = usageMapper;
    }

    @Override
    public ProjectUsageResponse createProjectUsage(ProjectUsageRequest request, String username) {
        if (request.getQuantityUsed() == null || request.getQuantityUsed() <= 0) {
            throw new IllegalArgumentException("Quantity used must be greater than 0");
        }

        Project project = projectRepository.findById(request.getProjectId())
                .orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + request.getProjectId()));

        ComponentItem component = componentRepository.findById(request.getComponentId())
                .orElseThrow(() -> new ResourceNotFoundException("Component not found with id: " + request.getComponentId()));

        if (component.getQuantity() < request.getQuantityUsed()) {
            throw new InsufficientStockException("Insufficient stock available");
        }

        component.setQuantity(component.getQuantity() - request.getQuantityUsed());
        componentRepository.save(component);

        InventoryTransaction transaction = InventoryTransaction.builder()
                .component(component)
                .transactionType(TransactionType.STOCK_OUT)
                .quantity(request.getQuantityUsed())
                .remarks("Project usage: " + request.getRemarks())
                .createdBy(username)
                .build();
        transactionRepository.save(transaction);

        ProjectComponentUsage usage = usageMapper.toEntity(request, project, component, username);
        ProjectComponentUsage savedUsage = usageRepository.save(usage);
        return usageMapper.toResponse(savedUsage);
    }

    @Override
    public ProjectUsageResponse getProjectUsageById(Long id) {
        ProjectComponentUsage usage = usageRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project usage not found with id: " + id));
        return usageMapper.toResponse(usage);
    }

    @Override
    public PagedResponse<ProjectUsageResponse> getUsageByProject(Long projectId, int page, int size, String sortBy, String sortDir) {
        projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + projectId));
        Pageable pageable = createPageable(page, size, sortBy, sortDir);
        Page<ProjectComponentUsage> usagePage = usageRepository.findByProjectId(projectId, pageable);
        return mapPage(usagePage);
    }

    @Override
    public PagedResponse<ProjectUsageResponse> getUsageByComponent(Long componentId, int page, int size, String sortBy, String sortDir) {
        componentRepository.findById(componentId)
                .orElseThrow(() -> new ResourceNotFoundException("Component not found with id: " + componentId));
        Pageable pageable = createPageable(page, size, sortBy, sortDir);
        Page<ProjectComponentUsage> usagePage = usageRepository.findByComponentId(componentId, pageable);
        return mapPage(usagePage);
    }

    @Override
    public PagedResponse<ProjectUsageResponse> getAllProjectUsage(int page, int size, String sortBy, String sortDir) {
        Pageable pageable = createPageable(page, size, sortBy, sortDir);
        Page<ProjectComponentUsage> usagePage = usageRepository.findAll(pageable);
        return mapPage(usagePage);
    }

    @Override
    public ProjectUsageSummaryResponse getProjectUsageSummary(Long projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + projectId));

        List<ProjectComponentUsage> usages = usageRepository.findByProjectId(projectId, Pageable.unpaged()).getContent();

        Map<Long, Integer> aggregatedQuantities = usages.stream()
                .collect(Collectors.groupingBy(usage -> usage.getComponent().getId(),
                        Collectors.summingInt(ProjectComponentUsage::getQuantityUsed)));

        List<ProjectUsageSummaryResponse.ComponentUsageSummary> components = usages.stream()
                .collect(Collectors.toMap(
                        usage -> usage.getComponent().getId(),
                        usage -> {
                            ProjectUsageSummaryResponse.ComponentUsageSummary item = new ProjectUsageSummaryResponse.ComponentUsageSummary();
                            item.setComponentName(usage.getComponent().getComponentName());
                            item.setQuantityUsed(usage.getQuantityUsed());
                            return item;
                        },
                        (existing, replacement) -> {
                            existing.setQuantityUsed(existing.getQuantityUsed() + replacement.getQuantityUsed());
                            return existing;
                        }))
                .values().stream().collect(Collectors.toList());

        ProjectUsageSummaryResponse summary = new ProjectUsageSummaryResponse();
        summary.setProjectName(project.getProjectName());
        summary.setComponents(components);
        return summary;
    }

    private Pageable createPageable(int page, int size, String sortBy, String sortDir) {
        Sort sort = Sort.by(sortBy);
        sort = "desc".equalsIgnoreCase(sortDir) ? sort.descending() : sort.ascending();
        return PageRequest.of(page, size, sort);
    }

    private PagedResponse<ProjectUsageResponse> mapPage(Page<ProjectComponentUsage> pageData) {
        PagedResponse<ProjectUsageResponse> response = new PagedResponse<>();
        response.setContent(pageData.stream().map(usageMapper::toResponse).collect(Collectors.toList()));
        response.setPage(pageData.getNumber());
        response.setSize(pageData.getSize());
        response.setTotalElements(pageData.getTotalElements());
        response.setTotalPages(pageData.getTotalPages());
        response.setLast(pageData.isLast());
        return response;
    }
}
