package com.company.inventory.library.dto.response;

import java.time.LocalDateTime;

import com.company.inventory.library.entity.BookStatus;

import lombok.Builder;
import lombok.Data;

/** Read model for a book, including derived availability for the UI. */
@Data
@Builder
public class BookResponse {

    private Long id;
    private String bookCode;
    private String title;
    private String author;
    private String publisher;
    private String isbn;
    private String edition;
    private String category;
    private String language;
    private String shelfLocation;
    private Integer totalCopies;
    private Integer availableCopies;
    private Integer issuedCopies;
    private BookStatus status;
    /** Derived label for the UI: "Available" when copies are in hand, else "Unavailable". */
    private String availability;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
