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
                    throw new IllegalArgumentException(duplicateMessage(existing));
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
                    throw new IllegalArgumentException(duplicateMessage(component));
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
        if (keyword != null && !keyword.isBlank()) {
            return searchWithCloseMatches(keyword, categoryId, category, status, stockStatus, page, size, sortBy, sortDir);
        }
        Pageable pageable = createPageable(page, size, sortBy, sortDir);
        Specification<ComponentItem> spec = buildComponentSpecification(keyword, categoryId, category, status, stockStatus);
        if (isItemCodeSort(sortBy)) {
            Sort.Direction direction = "desc".equalsIgnoreCase(sortDir) ? Sort.Direction.DESC : Sort.Direction.ASC;
            spec = spec.and(categoryThenItemCodeOrder(direction));
        }
        Page<ComponentItem> componentPage = componentRepository.findAll(spec, pageable);
        return mapPage(componentPage);
    }

    /**
     * A search: literal matches first (in the requested order), then components the text
     * most likely means even though it does not literally appear in them — a pasted
     * "PCF8563T" finds "PCF8563-Real-time clock", "AO3401A" finds "A03401A- PMOS",
     * "100nF" finds "0.1UF". Close matches are flagged so the list says why they are there.
     *
     * <p>Paged in memory: a search narrows the list to a few dozen rows at most, and the
     * close-match scoring needs the candidates in Java anyway.</p>
     */
    private PagedResponse<ComponentResponse> searchWithCloseMatches(String keyword, Long categoryId, String category,
                                                                    String status, String stockStatus,
                                                                    int page, int size, String sortBy, String sortDir) {
        Specification<ComponentItem> spec = buildComponentSpecification(keyword, categoryId, category, status, stockStatus);
        List<ComponentItem> literal = findAllSorted(spec, sortBy, sortDir);

        List<ComponentResponse> all = new ArrayList<>();
        java.util.Set<Long> seen = new java.util.HashSet<>();
        for (ComponentItem c : literal) {
            all.add(componentMapper.toResponse(c));
            seen.add(c.getId());
        }

        // Same filters, no keyword: the candidates a close match may come from.
        List<ComponentItem> pool = componentRepository.findAll(
                buildComponentSpecification(null, categoryId, category, status, stockStatus));
        for (BomMatcher.Match m : BomMatcher.search(keyword, pool)) {
            ComponentItem c = m.target().c;
            boolean possible = "LOW".equals(m.confidence());
            // Beside literal hits only confident extras are worth showing; with no literal
            // hit, a possible match is better than an empty page.
            if (!seen.add(c.getId()) || (possible && !literal.isEmpty())) {
                continue;
            }
            ComponentResponse r = componentMapper.toResponse(c);
            r.setSearchMatch(possible ? "POSSIBLE" : "CLOSE");
            r.setSearchNote(searchNote(m));
            all.add(r);
        }

        int safeSize = size < 1 ? 10 : Math.min(size, 500);
        int safePage = Math.max(0, page);
        int from = Math.min(safePage * safeSize, all.size());
        int to = Math.min(from + safeSize, all.size());
        PagedResponse<ComponentResponse> response = new PagedResponse<>();
        response.setContent(new ArrayList<>(all.subList(from, to)));
        response.setPage(safePage);
        response.setSize(safeSize);
        response.setTotalElements(all.size());
        response.setTotalPages((int) Math.ceil(all.size() / (double) safeSize));
        response.setLast(to >= all.size());
        return response;
    }

    /** Why a close search result is shown, in search wording rather than BOM wording. */
    private static String searchNote(BomMatcher.Match m) {
        String note = m.note();
        if (note == null) {
            return switch (m.type()) {
                case "VALUE" -> "Same value, written differently";
                case "EXACT" -> "Same part number";
                case "PART_IN_NAME" -> "Part number found in the name";
                case "WORDS", "FUZZY" -> "Similar name";
                default -> "Similar part";
            };
        }
        return note.replace("— BOM ", "— searched ")
                .replace("BOM asks for the", "You searched the")
                .replace("BOM needs", "searched for")
                .replace("BOM says", "search says");
    }

    /** Every row of a query, in the same order the paged list uses. */
    private List<ComponentItem> findAllSorted(Specification<ComponentItem> spec, String sortBy, String sortDir) {
        Sort.Direction direction = "desc".equalsIgnoreCase(sortDir) ? Sort.Direction.DESC : Sort.Direction.ASC;
        if (isItemCodeSort(sortBy)) {
            return componentRepository.findAll(spec.and(categoryThenItemCodeOrder(direction)));
        }
        return componentRepository.findAll(spec, createPageable(0, 1, sortBy, sortDir).getSort());
    }

    @Override
    public List<ComponentResponse> getLowStockComponents() {
        return componentRepository.findLowStock().stream()
                .map(componentMapper::toResponse)
                .collect(Collectors.toList());
    }

    /** Sort fields a client may request; anything else falls back to the item code. */
    private static final java.util.Set<String> SORTABLE = java.util.Set.of(
            "itemCode", "componentName", "category", "type", "value", "quantity",
            "minimumQuantity", "unitPrice", "location", "status", "createdAt", "updatedAt", "id");

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

    /**
     * A clear, actionable message for a duplicate component name, naming the component
     * that already exists and its code so the user can go straight to it instead of
     * reading a generic "name must be unique". Matching is case-insensitive at the
     * database level, so this also fires for a differently-cased spelling of the name.
     */
    private static String duplicateMessage(ComponentItem existing) {
        String code = existing.getItemCode() != null ? existing.getItemCode() : "no code";
        return String.format(
                "A component named \"%s\" already exists (%s, %d in stock). "
                        + "Open that component to add stock or edit it, instead of creating a duplicate.",
                existing.getComponentName(), code,
                existing.getQuantity() != null ? existing.getQuantity() : 0);
    }

    /** lower(text) with spaces, hyphens and underscores removed. */
    private static jakarta.persistence.criteria.Expression<String> withoutSeparators(
            jakarta.persistence.criteria.CriteriaBuilder cb, jakarta.persistence.criteria.Expression<String> text) {
        jakarta.persistence.criteria.Expression<String> e = cb.lower(text);
        for (String sep : new String[] {" ", "-", "_"}) {
            e = cb.function("replace", String.class, e, cb.literal(sep), cb.literal(""));
        }
        return e;
    }

    private Specification<ComponentItem> buildComponentSpecification(String keyword, Long categoryId, String category,
                                                                     String status, String stockStatus) {
        return (root, query, cb) -> {
        	List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();

            if (keyword != null && !keyword.isBlank()) {
                // Multi-word search: each whitespace-separated word must appear in at least
                // one text field (OR across fields), and every word must match (AND across
                // words). So "bc456" finds "IC BC456", and "resistor 10k" finds a resistor
                // whose value is 10k — order and position within the name do not matter.
                //
                // Fields covered: item code (part number), name, category, type, value,
                // unit, location, rack, description. The category term reads through the
                // join, so "resistor" still finds every resistor. itemCode stays searchable
                // even though the UI no longer shows it — anyone who knows a part number
                // can still type it and get a hit.
                jakarta.persistence.criteria.Join<?, ?> cat = categoryJoin(root);
                for (String word : keyword.trim().toLowerCase().split("\\s+")) {
                    if (word.isEmpty()) {
                        continue;
                    }
                    String pattern = "%" + word + "%";
                    // Separators are ignored on both sides, so "lm358", "16mhz" and "nulink"
                    // find "LM 358 DIP-8", "16 Mhz" and "Nu-Link".
                    String compact = "%" + word.replaceAll("[-_]", "") + "%";
                    predicates.add(cb.or(
                            cb.like(withoutSeparators(cb, root.get("componentName")), compact),
                            cb.like(withoutSeparators(cb, root.get("value")), compact),
                            cb.like(withoutSeparators(cb, root.get("type")), compact),
                            cb.like(cb.lower(root.get("itemCode")), pattern),
                            cb.like(cb.lower(root.get("componentName")), pattern),
                            cb.like(cb.lower(cat.get("name")), pattern),
                            cb.like(cb.lower(root.get("type")), pattern),
                            cb.like(cb.lower(root.get("value")), pattern),
                            cb.like(cb.lower(root.get("unit")), pattern),
                            cb.like(cb.lower(root.get("location")), pattern),
                            cb.like(cb.lower(root.get("rackNo")), pattern),
                            cb.like(cb.lower(root.get("description")), pattern)
                    ));
                }
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
