package com.company.inventory.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.company.inventory.dto.request.RelocateComponentsRequest;
import com.company.inventory.entity.ComponentCategory;
import com.company.inventory.entity.ComponentItem;
import com.company.inventory.exception.ResourceNotFoundException;
import com.company.inventory.mapper.ComponentMapper;
import com.company.inventory.repository.ComponentRepository;

class ComponentPlacementServiceTest {

    private ComponentRepository repo;
    private ComponentCategoryService categories;
    private ComponentPlacementService service;
    private final ComponentCategory capacitor = ComponentCategory.builder().id(1L).name("Capacitor").build();
    private final ComponentCategory ic = ComponentCategory.builder().id(2L).name("IC").build();

    @BeforeEach
    void setUp() {
        repo = mock(ComponentRepository.class);
        categories = mock(ComponentCategoryService.class);
        when(categories.requireById(2L)).thenReturn(ic);
        when(repo.save(any(ComponentItem.class))).thenAnswer(inv -> inv.getArgument(0));
        service = new ComponentPlacementService(repo, categories, mock(ComponentMapper.class));
    }

    private ComponentItem part(long id, String type, String value) {
        return ComponentItem.builder().id(id).componentName("part " + id).category(capacitor)
                .type(type).value(value).quantity(15).minimumQuantity(2)
                .unitPrice(new BigDecimal("4.50")).rackNo("7").build();
    }

    private RelocateComponentsRequest req(List<Long> ids, Long categoryId, String type, String value) {
        RelocateComponentsRequest r = new RelocateComponentsRequest();
        r.setComponentIds(ids);
        r.setCategoryId(categoryId);
        r.setType(type);
        r.setValue(value);
        return r;
    }

    @Test
    void movesOnlyThePlacementFields() {
        ComponentItem pmos = part(5, null, null);
        when(repo.findAllById(any())).thenReturn(List.of(pmos));

        service.relocate(req(List.of(5L), 2L, " MOSFET ", "P-channel"));

        assertEquals(ic, pmos.getCategory());
        assertEquals("MOSFET", pmos.getType());
        assertEquals("P-channel", pmos.getValue());
        assertEquals(15, pmos.getQuantity(), "stock untouched");
        assertEquals("7", pmos.getRackNo(), "rack untouched");
        assertEquals(new BigDecimal("4.50"), pmos.getUnitPrice(), "price untouched");
    }

    @Test
    void emptyFieldsKeepEachComponentsOwnValue() {
        ComponentItem a = part(1, "Unspecified", "0.1uF");
        ComponentItem b = part(2, "Unspecified", "10uF");
        when(repo.findAllById(any())).thenReturn(List.of(a, b));

        // Renaming a whole Type: every component keeps its own Value.
        service.relocate(req(List.of(1L, 2L), null, "Ceramic", ""));

        assertEquals("Ceramic", a.getType());
        assertEquals("Ceramic", b.getType());
        assertEquals("0.1uF", a.getValue());
        assertEquals("10uF", b.getValue());
        assertEquals(capacitor, a.getCategory());
    }

    @Test
    void refusesNothingToChangeAndUnknownIds() {
        assertThrows(IllegalArgumentException.class,
                () -> service.relocate(req(List.of(1L), null, " ", null)));

        when(repo.findAllById(any())).thenReturn(List.of(part(1, "SMD", "1k")));
        assertThrows(ResourceNotFoundException.class,
                () -> service.relocate(req(List.of(1L, 99L), null, "THT", null)));
        verify(repo, never()).save(any());
    }
}
