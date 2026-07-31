package com.company.inventory.library.service;

import org.springframework.stereotype.Component;

import com.company.inventory.library.repository.BookRepository;

/**
 * Generates sequential, zero-padded book codes ({@code BK0001}, {@code BK0002}, …).
 * Mirrors the Inventory {@code ItemCodeGenerator} approach: the next number comes
 * from a numeric MAX over existing codes, so the sequence keeps climbing correctly
 * past {@code BK9999 → BK10000} and survives deletions of the latest row.
 */
@Component
public class BookCodeGenerator {

    public static final String BOOK_PREFIX = "BK";
    private static final int MIN_DIGITS = 4;

    private final BookRepository bookRepository;

    public BookCodeGenerator(BookRepository bookRepository) {
        this.bookRepository = bookRepository;
    }

    /** Highest book-code number currently persisted (0 if none). */
    public long currentNumber() {
        return bookRepository.findMaxBookCodeNumber();
    }

    /** The next free code, e.g. {@code BK0007}. */
    public String nextCode() {
        return buildCode(currentNumber() + 1);
    }

    public String buildCode(long number) {
        return BOOK_PREFIX + String.format("%0" + MIN_DIGITS + "d", number);
    }
}
