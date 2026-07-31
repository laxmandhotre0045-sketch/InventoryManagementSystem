package com.company.inventory.library.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.company.inventory.library.entity.Book;
import com.company.inventory.library.entity.BookStatus;

@Repository
public interface BookRepository extends JpaRepository<Book, Long> {

    boolean existsByBookCode(String bookCode);

    boolean existsByIsbnIgnoreCase(String isbn);

    Optional<Book> findByBookCodeIgnoreCase(String bookCode);

    long countByStatus(BookStatus status);

    /**
     * Highest numeric suffix currently used for a {@code BK####} code.
     * Uses a numeric CAST (not lexical MAX) so BK9999 → BK10000 is correct.
     * Returns 0 when no coded rows exist yet.
     */
    @Query(value = "SELECT COALESCE(MAX(CAST(SUBSTRING(book_code, 3) AS UNSIGNED)), 0) "
            + "FROM books WHERE book_code REGEXP '^BK[0-9]+$'", nativeQuery = true)
    long findMaxBookCodeNumber();

    @Query("SELECT COALESCE(SUM(b.totalCopies), 0) FROM Book b")
    long sumTotalCopies();

    @Query("SELECT COALESCE(SUM(b.availableCopies), 0) FROM Book b")
    long sumAvailableCopies();

    @Query("SELECT b FROM Book b WHERE "
            + "(:keyword IS NULL OR :keyword = '' "
            + " OR LOWER(b.title) LIKE LOWER(CONCAT('%', :keyword, '%')) "
            + " OR LOWER(b.author) LIKE LOWER(CONCAT('%', :keyword, '%')) "
            + " OR LOWER(b.bookCode) LIKE LOWER(CONCAT('%', :keyword, '%')) "
            + " OR LOWER(b.isbn) LIKE LOWER(CONCAT('%', :keyword, '%')) "
            + " OR LOWER(b.publisher) LIKE LOWER(CONCAT('%', :keyword, '%'))) "
            + "AND (:category IS NULL OR :category = '' OR b.category = :category) "
            + "AND (:status IS NULL OR b.status = :status)")
    Page<Book> search(@Param("keyword") String keyword,
                       @Param("category") String category,
                       @Param("status") BookStatus status,
                       Pageable pageable);

    @Query("SELECT DISTINCT b.category FROM Book b WHERE b.category IS NOT NULL AND b.category <> '' ORDER BY b.category")
    java.util.List<String> findDistinctCategories();
}
