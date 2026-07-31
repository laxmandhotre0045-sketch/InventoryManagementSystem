package com.company.inventory.library.dto.request;

import com.company.inventory.library.entity.BookStatus;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Payload for creating or updating a book. {@code bookCode} is auto-generated
 * on create and immutable, so it is intentionally absent here. {@code availableCopies}
 * is managed by the system (derived from totalCopies and active loans), not by clients.
 */
@Data
public class BookRequest {

    @NotBlank(message = "Title is required")
    @Size(max = 255, message = "Title must be at most 255 characters")
    private String title;

    @Size(max = 255, message = "Author must be at most 255 characters")
    private String author;

    @Size(max = 255, message = "Publisher must be at most 255 characters")
    private String publisher;

    @Size(max = 40, message = "ISBN must be at most 40 characters")
    private String isbn;

    @Size(max = 60)
    private String edition;

    @Size(max = 100)
    private String category;

    @Size(max = 60)
    private String language;

    @Size(max = 60)
    private String shelfLocation;

    @NotNull(message = "Total copies is required")
    @Min(value = 1, message = "Total copies must be at least 1")
    private Integer totalCopies;

    private BookStatus status;

    @Size(max = 1000, message = "Notes must be at most 1000 characters")
    private String notes;
}
