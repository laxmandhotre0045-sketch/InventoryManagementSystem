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
import com.company.inventory.entity.ComponentCategory;
import com.company.inventory.entity.ComponentItem;
import com.company.inventory.entity.ComponentStatus;
import com.company.inventory.exception.ResourceNotFoundException;
import com.company.inventory.mapper.ComponentMapper;
import com.company.inventory.repository.ComponentRepository;
import com.company.inventory.repository.InventoryTransactionRepository;
import com.company.inventory.repository.ProjectComponentUsageRepository;
import com.company.inventory.repository.PurchaseItemRepository;
import com.company.inventory.service.ComponentCategoryService;
import com.company.inventory.service.ComponentService;

@Service
@Transactional
public class ComponentServiceImpl implements ComponentService {

    private final ComponentRepository componentRepository;
    private final ComponentMapper componentMapper;
    private final InventoryTransactionRepository transactionRepository;
    private final PurchaseItemRepository purchaseItemRepository;
    private final ProjectComponentUsageRepository projectComponentUsageRepository;

    private final com.company.inventory.service.ItemCodeGenerator itemCodeGenerator;
    private final ComponentCategoryService categoryService;

    public ComponentServiceImpl(ComponentRepository componentRepository, ComponentMapper componentMapper,
                                InventoryTransactionRepository transactionRepository,
                                PurchaseItemRepository purchaseItemRepository,
                                ProjectComponentUsageRepository projectComponentUsageRepository,
                                com.company.inventory.service.ItemCodeGenerator itemCodeGenerator,
                                ComponentCategoryService categoryService) {
        this.componentRepository = componentRepository;
        this.componentMapper = componentMapper;
        this.transactionRepository = transactionRepository;
        this.purchaseItemRepository = purchaseItemRepository;
        this.projectComponentUsageRepository = projectComponentUsageRepository;
        this.itemCodeGenerator = itemCodeGenerator;
        this.categoryService = categoryService;
    }

    @Override
    public ComponentResponse createComponent(ComponentRequest request) {
        componentRepository.findByComponentName(request.getComponentName())
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("Component name must be unique");
                });

        // Resolved before the insert, so an unknown category id fails the request
        // instead of writing a component that points at nothing.
        ComponentCategory category = categoryService.requireById(request.getCategoryId());
        ComponentItem entity = componentMapper.toEntity(request, category);
        // Item code is system-assigned on creation and never taken from the request.
        entity.setItemCode(itemCodeGenerator.nextComponentCode());
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

        ComponentCategory category = categoryService.requireById(request.getCategoryId());
        componentMapper.updateEntity(request, existing, category);
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
                                                               String keyword, Long categoryId, String category,
                                                               String status, String stockStatus) {
        return searchComponents(keyword, categoryId, category, status, stockStatus, page, size, sortBy, sortDir);
    }

    @Override
    public PagedResponse<ComponentResponse> searchComponents(String keyword, Long categoryId, String category,
                                                              String status, String stockStatus,
                                                              int page, int size, String sortBy, String sortDir) {
        Pageable pageable = createPageable(page, size, sortBy, sortDir);
        Specification<ComponentItem> spec = buildComponentSpecification(keyword, categoryId, category, status, stockStatus);
        if (isItemCodeSort(sortBy)) {
            Sort.Direction direction = "desc".equalsIgnoreCase(sortDir) ? Sort.Direction.DESC : Sort.Direction.ASC;
            spec = spec.and(categoryThenItemCodeOrder(direction));
        }
        Page<ComponentItem> componentPage = componentRepository.findAll(spec, pageable);
        return mapPage(componentPage);
    }

    @Override
    public List<ComponentResponse> getLowStockComponents() {
        return componentRepository.findLowStock().stream()
                .map(componentMapper::toResponse)
                .collect(Collectors.toList());
    }

    /** Sort fields a client may request; anything else falls back to the item code. */
    private static final java.util.Set<String> SORTABLE = java.util.Set.of(
            "itemCode", "componentName", "category", "quantity", "minimumQuantity",
            "unitPrice", "location", "status", "createdAt", "updatedAt", "id");

    /**
     * Builds the page ordering, defaulting to item code ascending.
     *
     * <p>Item codes are zero-padded to four digits (C0001…C9999) and then grow a digit,
     * so a plain string sort puts C10000 between C0999 and C2000. Ordering by length
     * first and value second restores true numeric order for any width, and works the
     * same whether the query is filtered, searched or paged — the sort is applied by
     * the database over the whole matching set, not per page.</p>
     */
    private Pageable createPageable(int page, int size, String sortBy, String sortDir) {
        String property = (sortBy != null && SORTABLE.contains(sortBy)) ? sortBy : "itemCode";
        Sort.Direction direction = "desc".equalsIgnoreCase(sortDir) ? Sort.Direction.DESC : Sort.Direction.ASC;

        int safePage = Math.max(0, page);
        int safeSize = size < 1 ? 10 : Math.min(size, 500);

        if ("itemCode".equals(property)) {
            // Left unsorted here on purpose: the length-then-value ordering cannot be
            // expressed as a Sort property (Spring Data resolves those through
            // PropertyPath, which rejects function calls), so categoryThenItemCodeOrder()
            // applies it through the Criteria API instead.
            return PageRequest.of(safePage, safeSize);
        }
        if ("category".equals(property)) {
            // "category" is an association now, so sorting on it directly would order by
            // the foreign key — effectively by the order categories were created. Point
            // at the name, then fall back to the item code within each category.
            return PageRequest.of(safePage, safeSize,
                    Sort.by(direction, "category.name")
                            .and(Sort.by(Sort.Direction.ASC, "itemCode")));
        }
        // Id as the final tiebreak keeps paging stable when the primary column repeats.
        return PageRequest.of(safePage, safeSize,
                Sort.by(direction, property).and(Sort.by(Sort.Direction.ASC, "id")));
    }

    /** True when the caller wants the default item-code ordering. */
    private boolean isItemCodeSort(String sortBy) {
        return sortBy == null || sortBy.isBlank() || "itemCode".equals(sortBy) || !SORTABLE.contains(sortBy);
    }

    /**
     * The default ordering: category name first, then item code numerically within each
     * category.
     *
     * <p>Grouping by category is what makes the list navigable — all the resistors
     * together, then all the capacitors — and item code remains the tiebreak inside a
     * category, so the ascending-code requirement still holds where it is visible. The
     * database applies this over the whole matching set rather than per page, so a
     * category never straddles a page boundary out of order.</p>
     *
     * <p>Item codes are zero-padded to four digits and then grow (C9999 → C10000), so a
     * plain string sort would place C10000 between C0999 and C2000. Comparing length
     * first fixes that for any width.</p>
     *
     * <p>Applied as a Specification because both expressions involve function calls
     * ({@code length()}, and a CASE to keep uncategorised rows last) which {@link Sort}
     * cannot represent. The count query Spring issues for pagination shares this
     * Specification, and an ORDER BY there is both pointless and rejected by some
     * databases — hence the result-type guard.</p>
     */
    private Specification<ComponentItem> categoryThenItemCodeOrder(Sort.Direction direction) {
        return (root, query, cb) -> {
            Class<?> resultType = query.getResultType();
            if (resultType != Long.class && resultType != long.class) {
                jakarta.persistence.criteria.Join<?, ?> categoryJoin = categoryJoin(root);

                // MySQL sorts NULL first on ASC, which would float uncategorised rows to
                // the top of the list. This keeps them at the end in either direction.
                jakarta.persistence.criteria.Expression<Integer> nullsLast = cb.<Integer>selectCase()
                        .when(categoryJoin.get("name").isNull(), 1)
                        .otherwise(0)
                        .as(Integer.class);
                jakarta.persistence.criteria.Expression<String> categoryName = categoryJoin.get("name");
                jakarta.persistence.criteria.Expression<Integer> length = cb.length(root.get("itemCode"));
                jakarta.persistence.criteria.Expression<String> code = root.get("itemCode");

                query.orderBy(direction == Sort.Direction.DESC
                        ? List.of(cb.asc(nullsLast), cb.desc(categoryName), cb.desc(length), cb.desc(code))
                        : List.of(cb.asc(nullsLast), cb.asc(categoryName), cb.asc(length), cb.asc(code)));
            }
            return cb.conjunction();
        };
    }

    /**
     * The single LEFT join to {@code category}, reused across every Specification in the
     * query.
     *
     * <p>Filtering and ordering both need the category name, and they live in separate
     * Specification lambdas that Spring combines. Each calling {@code root.join} would
     * put two identical joins in the SQL. They share a Root within one query, so
     * checking what is already joined lets the second caller reuse the first one's.</p>
     *
     * <p>LEFT rather than INNER so a component with no category — impossible after the
     * migration, but not impossible to reintroduce — is still listed and searchable
     * rather than silently vanishing from the inventory.</p>
     */
    private jakarta.persistence.criteria.Join<?, ?> categoryJoin(
            jakarta.persistence.criteria.Root<ComponentItem> root) {
        for (jakarta.persistence.criteria.Join<ComponentItem, ?> existing : root.getJoins()) {
            if ("category".equals(existing.getAttribute().getName())) {
                return existing;
            }
        }
        return root.join("category", jakarta.persistence.criteria.JoinType.LEFT);
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

    private Specification<ComponentItem> buildComponentSpecification(String keyword, Long categoryId, String category,
                                                                     String status, String stockStatus) {
        return (root, query, cb) -> {
        	List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();

            if (keyword != null && !keyword.isBlank()) {
                String pattern = "%" + keyword.toLowerCase().trim() + "%";
                // One search box matches every text field of a component:
                // item code (part number), name, category, unit, location, description.
                // The category term now reads through the join, so searching "resistor"
                // still finds every resistor exactly as it did when it was a text column.
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("itemCode")), pattern),
                        cb.like(cb.lower(root.get("componentName")), pattern),
                        cb.like(cb.lower(categoryJoin(root).get("name")), pattern),
                        cb.like(cb.lower(root.get("unit")), pattern),
                        cb.like(cb.lower(root.get("location")), pattern),
                        cb.like(cb.lower(root.get("description")), pattern)
                ));
            }

            // Id is the precise filter the dropdown sends. The name form is kept for API
            // callers written against the old free-text column, and matched
            // case-insensitively so "resistor" and "Resistor" behave the same.
            if (categoryId != null) {
                predicates.add(cb.equal(categoryJoin(root).get("id"), categoryId));
            } else if (category != null && !category.isBlank()) {
                predicates.add(cb.equal(cb.lower(categoryJoin(root).get("name")), category.toLowerCase().trim()));
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
