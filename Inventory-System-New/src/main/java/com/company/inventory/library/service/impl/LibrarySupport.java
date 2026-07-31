package com.company.inventory.library.service.impl;

import java.util.List;
import java.util.function.Function;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import com.company.inventory.dto.response.PagedResponse;

/** Small internal helpers shared by the Library service implementations. */
final class LibrarySupport {

    private LibrarySupport() {
    }

    /** Build a safe, bounded Pageable with a whitelisted sort direction. */
    static Pageable pageable(int page, int size, String sortBy, String sortDir, String defaultSort) {
        int safePage = Math.max(0, page);
        int safeSize = size < 1 ? 10 : Math.min(size, 200);
        String property = (sortBy == null || sortBy.isBlank()) ? defaultSort : sortBy;
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDir) ? Sort.Direction.ASC : Sort.Direction.DESC;
        return PageRequest.of(safePage, safeSize, Sort.by(direction, property));
    }

    /** Map a Spring {@link Page} of entities into the project's {@link PagedResponse} envelope. */
    static <E, R> PagedResponse<R> toPaged(Page<E> source, Function<E, R> mapper) {
        List<R> content = source.getContent().stream().map(mapper).toList();
        PagedResponse<R> response = new PagedResponse<>();
        response.setContent(content);
        response.setPage(source.getNumber());
        response.setSize(source.getSize());
        response.setTotalElements(source.getTotalElements());
        response.setTotalPages(source.getTotalPages());
        response.setLast(source.isLast());
        return response;
    }
}
