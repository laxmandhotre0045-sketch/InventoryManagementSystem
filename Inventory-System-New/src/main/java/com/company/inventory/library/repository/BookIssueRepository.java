package com.company.inventory.library.repository;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.company.inventory.library.entity.BookIssue;
import com.company.inventory.library.entity.IssueStatus;

@Repository
public interface BookIssueRepository extends JpaRepository<BookIssue, Long> {

    long countByStatus(IssueStatus status);

    /** Active loans that are past their due date (derived "overdue"). */
    @Query("SELECT COUNT(i) FROM BookIssue i WHERE i.status = com.company.inventory.library.entity.IssueStatus.ISSUED AND i.dueDate < :today")
    long countOverdue(@Param("today") LocalDate today);

    long countByMemberIdAndStatus(Long memberId, IssueStatus status);

    Page<BookIssue> findByStatus(IssueStatus status, Pageable pageable);

    Page<BookIssue> findByMemberId(Long memberId, Pageable pageable);

    Page<BookIssue> findByBookId(Long bookId, Pageable pageable);

    @Query("SELECT i FROM BookIssue i WHERE i.status = com.company.inventory.library.entity.IssueStatus.ISSUED AND i.dueDate < :today")
    Page<BookIssue> findOverdue(@Param("today") LocalDate today, Pageable pageable);

    @Query("SELECT i FROM BookIssue i WHERE i.returnDate IS NOT NULL")
    Page<BookIssue> findReturned(Pageable pageable);

    /**
     * Full lending history with optional filters. keyword matches book title/code
     * or member name/employee id. Powers both "Book History" and search.
     */
    @Query("SELECT i FROM BookIssue i WHERE "
            + "(:keyword IS NULL OR :keyword = '' "
            + " OR LOWER(i.book.title) LIKE LOWER(CONCAT('%', :keyword, '%')) "
            + " OR LOWER(i.book.bookCode) LIKE LOWER(CONCAT('%', :keyword, '%')) "
            + " OR LOWER(i.member.name) LIKE LOWER(CONCAT('%', :keyword, '%')) "
            + " OR LOWER(i.member.employeeId) LIKE LOWER(CONCAT('%', :keyword, '%'))) "
            + "AND (:status IS NULL OR i.status = :status)")
    Page<BookIssue> searchHistory(@Param("keyword") String keyword,
                                  @Param("status") IssueStatus status,
                                  Pageable pageable);

    /** Most-borrowed titles: [bookId, bookCode, title, author, borrowCount]. */
    @Query("SELECT i.book.id, i.book.bookCode, i.book.title, i.book.author, COUNT(i) AS cnt "
            + "FROM BookIssue i GROUP BY i.book.id, i.book.bookCode, i.book.title, i.book.author "
            + "ORDER BY cnt DESC")
    List<Object[]> findMostBorrowed(Pageable pageable);

    List<BookIssue> findTop5ByOrderByIssueDateDescIdDesc();

    List<BookIssue> findTop5ByReturnDateIsNotNullOrderByReturnDateDescIdDesc();

    boolean existsByBookIdAndStatus(Long bookId, IssueStatus status);

    boolean existsByMemberIdAndStatus(Long memberId, IssueStatus status);
}
