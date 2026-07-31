package com.company.inventory.library.mapper;

import org.springframework.stereotype.Component;

import com.company.inventory.library.dto.request.BookRequest;
import com.company.inventory.library.dto.response.BookResponse;
import com.company.inventory.library.entity.Book;
import com.company.inventory.library.entity.BookStatus;

/** Maps between {@link Book} entities and their DTOs. */
@Component
public class BookMapper {

    public BookResponse toResponse(Book book) {
        int total = book.getTotalCopies() != null ? book.getTotalCopies() : 0;
        int available = book.getAvailableCopies() != null ? book.getAvailableCopies() : 0;
        int issued = Math.max(0, total - available);
        boolean inStock = available > 0 && book.getStatus() == BookStatus.ACTIVE;
        return BookResponse.builder()
                .id(book.getId())
                .bookCode(book.getBookCode())
                .title(book.getTitle())
                .author(book.getAuthor())
                .publisher(book.getPublisher())
                .isbn(book.getIsbn())
                .edition(book.getEdition())
                .category(book.getCategory())
                .language(book.getLanguage())
                .shelfLocation(book.getShelfLocation())
                .totalCopies(total)
                .availableCopies(available)
                .issuedCopies(issued)
                .status(book.getStatus())
                .availability(inStock ? "Available" : "Unavailable")
                .notes(book.getNotes())
                .createdAt(book.getCreatedAt())
                .updatedAt(book.getUpdatedAt())
                .build();
    }

    /**
     * Copies editable fields from the request onto the entity. Deliberately does
     * NOT touch bookCode or availableCopies — those are system-managed.
     */
    public void applyEditableFields(BookRequest request, Book book) {
        book.setTitle(trim(request.getTitle()));
        book.setAuthor(trim(request.getAuthor()));
        book.setPublisher(trim(request.getPublisher()));
        book.setIsbn(trim(request.getIsbn()));
        book.setEdition(trim(request.getEdition()));
        book.setCategory(trim(request.getCategory()));
        book.setLanguage(trim(request.getLanguage()));
        book.setShelfLocation(trim(request.getShelfLocation()));
        book.setNotes(trim(request.getNotes()));
        if (request.getStatus() != null) {
            book.setStatus(request.getStatus());
        }
    }

    private String trim(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
