package com.company.inventory.library.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A catalogue title in the library. Copies are tracked at the title level:
 * {@code totalCopies} never changes on issue/return, while {@code availableCopies}
 * moves down on issue and up on return.
 *
 * <p>This entity lives in its own {@code books} table and is completely
 * independent of the Inventory Management schema.</p>
 */
@Entity
@Table(name = "books", indexes = {
        @Index(name = "idx_books_book_code", columnList = "book_code", unique = true),
        @Index(name = "idx_books_title", columnList = "title"),
        @Index(name = "idx_books_category", columnList = "category")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Book {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "book_code", nullable = false, unique = true, length = 20)
    private String bookCode;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(length = 255)
    private String author;

    @Column(length = 255)
    private String publisher;

    @Column(length = 40)
    private String isbn;

    @Column(length = 60)
    private String edition;

    @Column(length = 100)
    private String category;

    @Column(length = 60)
    private String language;

    @Column(name = "shelf_location", length = 60)
    private String shelfLocation;

    @Column(name = "total_copies", nullable = false)
    private Integer totalCopies;

    @Column(name = "available_copies", nullable = false)
    private Integer availableCopies;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private BookStatus status = BookStatus.ACTIVE;

    @Column(length = 1000)
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
