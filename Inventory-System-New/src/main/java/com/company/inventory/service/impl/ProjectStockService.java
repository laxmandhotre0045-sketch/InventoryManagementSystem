package com.company.inventory.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.company.inventory.dto.request.AddProjectComponentRequest;
import com.company.inventory.dto.response.ComponentProjectTag;
import com.company.inventory.dto.response.ComponentResponse;
import com.company.inventory.dto.response.ProjectFolderResponse;
import com.company.inventory.dto.response.PurchaseResponse;
import com.company.inventory.entity.ComponentItem;
import com.company.inventory.entity.ComponentStatus;
import com.company.inventory.entity.InventoryTransaction;
import com.company.inventory.entity.Project;
import com.company.inventory.entity.ProjectStock;
import com.company.inventory.entity.Purchase;
import com.company.inventory.entity.TransactionType;
import com.company.inventory.exception.InsufficientStockException;
import com.company.inventory.exception.ResourceNotFoundException;
import com.company.inventory.mapper.PurchaseMapper;
import com.company.inventory.repository.ComponentRepository;
import com.company.inventory.repository.InventoryTransactionRepository;
import com.company.inventory.repository.ProjectComponentUsageRepository;
import com.company.inventory.repository.ProjectRepository;
import com.company.inventory.repository.ProjectStockRepository;
import com.company.inventory.repository.PurchaseRepository;

/**
 * A project's component folder.
 *
 * <p>Components stay single inventory records (so the main inventory still lists and
 * counts them); the folder records which units belong to which project and what they
 * cost. Units get into a folder three ways: bought for the project by hand (stock goes
 * up), through an invoice scanned in the project (stock goes up, done by the purchase
 * flow), or set aside from existing stock (stock unchanged). Using them in the project is
 * the existing usage record, which takes stock out.</p>
 */
@Service
@Transactional
public class ProjectStockService {

    private final ProjectStockRepository stockRepository;
    private final ProjectRepository projectRepository;
    private final ComponentRepository componentRepository;
    private final ProjectComponentUsageRepository usageRepository;
    private final InventoryTransactionRepository transactionRepository;
    private final PurchaseRepository purchaseRepository;
    private final PurchaseMapper purchaseMapper;

    public ProjectStockService(ProjectStockRepository stockRepository, ProjectRepository projectRepository,
                               ComponentRepository componentRepository, ProjectComponentUsageRepository usageRepository,
                               InventoryTransactionRepository transactionRepository, PurchaseRepository purchaseRepository,
                               PurchaseMapper purchaseMapper) {
        this.stockRepository = stockRepository;
        this.projectRepository = projectRepository;
        this.componentRepository = componentRepository;
        this.usageRepository = usageRepository;
        this.transactionRepository = transactionRepository;
        this.purchaseRepository = purchaseRepository;
        this.purchaseMapper = purchaseMapper;
    }

    // ------------------------------------------------------------------ changes

    /** Puts units of a component into the project's folder. */
    public ProjectFolderResponse add(Long projectId, AddProjectComponentRequest request, String username) {
        Project project = requireProject(projectId);
        ComponentItem component = componentRepository.findById(request.getComponentId())
                .orElseThrow(() -> new ResourceNotFoundException("Component not found with id: " + request.getComponentId()));
        if (component.getStatus() == ComponentStatus.ARCHIVED) {
            throw new IllegalArgumentException(component.getComponentName() + " is archived — restore it before using it in a project");
        }
        int qty = request.getQuantity();
        BigDecimal price = request.getUnitPrice() != null ? request.getUnitPrice() : component.getUnitPrice();

        String source;
        if (ProjectStock.BOUGHT.equals(request.getMode())) {
            // New units arrived for this project: they are real stock, so inventory goes up.
            component.setQuantity(nz(component.getQuantity()) + qty);
            if (request.getUnitPrice() != null && request.getUnitPrice().signum() > 0) {
                component.setUnitPrice(request.getUnitPrice());
            }
            componentRepository.save(component);
            transactionRepository.save(InventoryTransaction.builder()
                    .component(component)
                    .transactionType(TransactionType.STOCK_IN)
                    .quantity(qty)
                    .remarks("Bought for project: " + project.getProjectName())
                    .createdBy(username)
                    .build());
            source = ProjectStock.BOUGHT;
        } else {
            // Setting aside existing stock: only units not already set aside for projects.
            int free = nz(component.getQuantity()) - reservedForProjects(component.getId());
            if (qty > free) {
                throw new InsufficientStockException("Only " + Math.max(free, 0) + " of " + component.getComponentName()
                        + " are free to set aside (" + nz(component.getQuantity()) + " in stock, the rest already belongs to "
                        + "projects). Choose \"Bought for this project\" if new units were purchased.");
            }
            source = ProjectStock.RESERVED;
        }

        stockRepository.save(ProjectStock.builder()
                .project(project)
                .component(component)
                .quantity(qty)
                .unitPrice(price)
                .source(source)
                .notes(blankToNull(request.getNotes()))
                .createdBy(username)
                .build());
        return folder(projectId, null);
    }

    /** Called by the purchase flow for every component line of an invoice made for a project. */
    public void addFromInvoice(Project project, ComponentItem component, int quantity, BigDecimal unitPrice,
                               Long purchaseId, String invoiceNumber, String username) {
        stockRepository.save(ProjectStock.builder()
                .project(project)
                .component(component)
                .quantity(quantity)
                .unitPrice(unitPrice)
                .source(ProjectStock.INVOICE)
                .purchaseId(purchaseId)
                .notes("Invoice " + invoiceNumber)
                .createdBy(username)
                .build());
    }

    /**
     * Takes one entry out of the folder. Stock is not touched: the units stay in the
     * inventory and simply stop belonging to the project.
     */
    public ProjectFolderResponse release(Long projectId, Long entryId) {
        ProjectStock entry = stockRepository.findById(entryId)
                .orElseThrow(() -> new ResourceNotFoundException("Folder entry not found with id: " + entryId));
        if (!entry.getProject().getId().equals(projectId)) {
            throw new IllegalArgumentException("That entry belongs to a different project");
        }
        stockRepository.delete(entry);
        return folder(projectId, null);
    }

    // ------------------------------------------------------------------ reading

    /**
     * The folder, with its cost summary. A search only looks inside this project: literal
     * matches first, then close matches (pasted part numbers, values written differently).
     */
    @Transactional(readOnly = true)
    public ProjectFolderResponse folder(Long projectId, String keyword) {
        Project project = requireProject(projectId);
        List<ProjectStock> entries = stockRepository.findForProject(projectId);
        Map<Long, Integer> usedByComponent = new HashMap<>();
        for (Object[] r : usageRepository.usedByComponentForProject(projectId)) {
            usedByComponent.put((Long) r[0], ((Number) r[1]).intValue());
        }

        // One row per component, in the order it first entered the folder.
        Map<Long, ProjectFolderResponse.Item> rows = new LinkedHashMap<>();
        Map<Long, ComponentItem> components = new LinkedHashMap<>();
        for (ProjectStock e : entries) {
            ComponentItem c = e.getComponent();
            components.putIfAbsent(c.getId(), c);
            ProjectFolderResponse.Item row = rows.computeIfAbsent(c.getId(), id -> newRow(c));
            row.setAllocated(row.getAllocated() + e.getQuantity());
            row.setTotalCost(row.getTotalCost().add(cost(e.getQuantity(), e.getUnitPrice())));
            if (!row.getSources().contains(e.getSource())) {
                row.getSources().add(e.getSource());
            }
            row.getEntries().add(toEntry(e));
        }
        // Components used in the project without being put in its folder still belong in its view.
        List<Long> usedOnly = usedByComponent.keySet().stream().filter(id -> !rows.containsKey(id)).toList();
        for (ComponentItem c : componentRepository.findAllById(usedOnly)) {
            components.put(c.getId(), c);
            rows.put(c.getId(), newRow(c));
        }
        attachInvoiceNumbers(rows.values());

        ProjectFolderResponse resp = new ProjectFolderResponse();
        resp.setProjectId(project.getId());
        resp.setProjectName(project.getProjectName());
        resp.setBudget(project.getBudget());
        BigDecimal total = BigDecimal.ZERO;
        BigDecimal usedValue = BigDecimal.ZERO;
        int units = 0;
        int unitsUsed = 0;
        for (ProjectFolderResponse.Item row : rows.values()) {
            ComponentItem c = components.get(row.getComponentId());
            int used = usedByComponent.getOrDefault(row.getComponentId(), 0);
            row.setUsed(used);
            row.setRemaining(Math.max(row.getAllocated() - used, 0));
            BigDecimal unitPrice = row.getAllocated() > 0
                    ? row.getTotalCost().divide(BigDecimal.valueOf(row.getAllocated()), 2, RoundingMode.HALF_UP)
                    : c.getUnitPrice();
            row.setUnitPrice(unitPrice);
            total = total.add(row.getTotalCost());
            usedValue = usedValue.add(cost(used, unitPrice));
            units += row.getAllocated();
            unitsUsed += used;
        }
        resp.setTotalCost(total);
        resp.setUsedValue(usedValue);
        resp.setBudgetLeft(project.getBudget() != null ? project.getBudget().subtract(total) : null);
        resp.setComponentCount(rows.size());
        resp.setUnitsInFolder(units);
        resp.setUnitsUsed(unitsUsed);
        List<Purchase> purchases = purchaseRepository.findByProjectIdOrderByPurchaseDateDescIdDesc(projectId);
        resp.setInvoiceCount(purchases.size());
        resp.setInvoiceTotal(purchases.stream().map(Purchase::getTotalAmount)
                .filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add));

        resp.getItems().addAll(filter(rows, components, keyword));
        return resp;
    }

    @Transactional(readOnly = true)
    public List<PurchaseResponse> purchases(Long projectId) {
        requireProject(projectId);
        return purchaseRepository.findByProjectIdOrderByPurchaseDateDescIdDesc(projectId).stream()
                .map(purchaseMapper::toResponse).toList();
    }

    /** Fills in which projects each listed component belongs to (main inventory marking). */
    @Transactional(readOnly = true)
    public void tagComponents(Collection<ComponentResponse> responses) {
        if (responses.isEmpty()) {
            return;
        }
        Set<Long> ids = new HashSet<>();
        responses.forEach(r -> ids.add(r.getId()));
        Map<Long, List<ComponentProjectTag>> tags = tagsFor(ids);
        for (ComponentResponse r : responses) {
            List<ComponentProjectTag> t = tags.getOrDefault(r.getId(), List.of());
            r.setProjects(new ArrayList<>(t));
            r.setReservedForProjects(t.stream().mapToInt(ComponentProjectTag::getRemaining).sum());
        }
    }

    /** [projectId] -> {cost, distinct components} for the projects list. */
    @Transactional(readOnly = true)
    public Map<Long, Object[]> costsFor(Collection<Long> projectIds) {
        Map<Long, Object[]> out = new HashMap<>();
        if (projectIds.isEmpty()) {
            return out;
        }
        for (Object[] r : stockRepository.costsForProjects(projectIds)) {
            out.put((Long) r[0], new Object[] {toBigDecimal(r[1]), ((Number) r[2]).intValue()});
        }
        return out;
    }

    public boolean hasFolderEntries(Long projectId) {
        return stockRepository.existsByProjectId(projectId);
    }

    // ------------------------------------------------------------------ helpers

    private Map<Long, List<ComponentProjectTag>> tagsFor(Collection<Long> componentIds) {
        Map<String, Integer> used = new HashMap<>();
        for (Object[] r : usageRepository.usedForComponents(componentIds)) {
            used.put(r[0] + ":" + r[1], ((Number) r[2]).intValue());
        }
        Map<Long, List<ComponentProjectTag>> out = new HashMap<>();
        for (Object[] r : stockRepository.allocationsForComponents(componentIds)) {
            Long componentId = (Long) r[0];
            Long projectId = (Long) r[1];
            int allocated = ((Number) r[3]).intValue();
            int remaining = Math.max(allocated - used.getOrDefault(componentId + ":" + projectId, 0), 0);
            out.computeIfAbsent(componentId, k -> new ArrayList<>())
                    .add(new ComponentProjectTag(projectId, (String) r[2], allocated, remaining));
        }
        return out;
    }

    /** Units of a component still set aside for projects (allocated minus used, per project). */
    private int reservedForProjects(Long componentId) {
        return tagsFor(List.of(componentId)).getOrDefault(componentId, List.of()).stream()
                .mapToInt(ComponentProjectTag::getRemaining).sum();
    }

    private List<ProjectFolderResponse.Item> filter(Map<Long, ProjectFolderResponse.Item> rows,
                                                    Map<Long, ComponentItem> components, String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return new ArrayList<>(rows.values());
        }
        String[] words = keyword.trim().toLowerCase(Locale.ROOT).split("\\s+");
        List<ProjectFolderResponse.Item> out = new ArrayList<>();
        Set<Long> seen = new HashSet<>();
        for (ProjectFolderResponse.Item row : rows.values()) {
            String text = String.join(" ", nn(row.getComponentName()), nn(row.getCategory()), nn(row.getType()),
                    nn(row.getValue()), nn(row.getRackNo()), nn(row.getLocation()), nn(row.getItemCode()))
                    .toLowerCase(Locale.ROOT);
            String compact = text.replaceAll("[\\s\\-_]", "");
            boolean all = true;
            for (String w : words) {
                if (!text.contains(w) && !compact.contains(w.replaceAll("[\\-_]", ""))) {
                    all = false;
                    break;
                }
            }
            if (all) {
                out.add(row);
                seen.add(row.getComponentId());
            }
        }
        // Close matches, still only among this project's components.
        for (BomMatcher.Match m : BomMatcher.search(keyword, new ArrayList<>(components.values()))) {
            Long id = m.target().c.getId();
            boolean possible = "LOW".equals(m.confidence());
            if (!seen.add(id) || (possible && !out.isEmpty())) {
                continue;
            }
            ProjectFolderResponse.Item row = rows.get(id);
            row.setSearchMatch(possible ? "POSSIBLE" : "CLOSE");
            row.setSearchNote(m.note() != null ? m.note().replace("— BOM ", "— searched ") : "Similar part");
            out.add(row);
        }
        return out;
    }

    private void attachInvoiceNumbers(Collection<ProjectFolderResponse.Item> rows) {
        Set<Long> purchaseIds = new HashSet<>();
        rows.forEach(r -> r.getEntries().forEach(e -> {
            if (e.getPurchaseId() != null) {
                purchaseIds.add(e.getPurchaseId());
            }
        }));
        if (purchaseIds.isEmpty()) {
            return;
        }
        Map<Long, String> numbers = new HashMap<>();
        purchaseRepository.findAllById(purchaseIds).forEach(p -> numbers.put(p.getId(), p.getInvoiceNumber()));
        rows.forEach(r -> r.getEntries().forEach(e -> e.setInvoiceNumber(numbers.get(e.getPurchaseId()))));
    }

    private static ProjectFolderResponse.Item newRow(ComponentItem c) {
        ProjectFolderResponse.Item row = new ProjectFolderResponse.Item();
        row.setComponentId(c.getId());
        row.setItemCode(c.getItemCode());
        row.setComponentName(c.getComponentName());
        row.setCategory(c.getCategory() != null ? c.getCategory().getName() : null);
        row.setType(c.getType());
        row.setValue(c.getValue());
        row.setRackNo(c.getRackNo());
        row.setLocation(c.getLocation());
        row.setUnit(c.getUnit());
        row.setInStock(nz(c.getQuantity()));
        row.setTotalCost(BigDecimal.ZERO);
        return row;
    }

    private static ProjectFolderResponse.Entry toEntry(ProjectStock e) {
        ProjectFolderResponse.Entry x = new ProjectFolderResponse.Entry();
        x.setId(e.getId());
        x.setQuantity(e.getQuantity());
        x.setUnitPrice(e.getUnitPrice());
        x.setSource(e.getSource());
        x.setPurchaseId(e.getPurchaseId());
        x.setNotes(e.getNotes());
        x.setCreatedBy(e.getCreatedBy());
        x.setCreatedAt(e.getCreatedAt());
        return x;
    }

    private Project requireProject(Long id) {
        return projectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + id));
    }

    private static BigDecimal cost(int qty, BigDecimal unitPrice) {
        return unitPrice == null ? BigDecimal.ZERO : unitPrice.multiply(BigDecimal.valueOf(qty));
    }

    private static BigDecimal toBigDecimal(Object o) {
        if (o == null) {
            return BigDecimal.ZERO;
        }
        return o instanceof BigDecimal b ? b : new BigDecimal(o.toString());
    }

    private static int nz(Integer i) {
        return i == null ? 0 : i;
    }

    private static String nn(String s) {
        return s == null ? "" : s;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
