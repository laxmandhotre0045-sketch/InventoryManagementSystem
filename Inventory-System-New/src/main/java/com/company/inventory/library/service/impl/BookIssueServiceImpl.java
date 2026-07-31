package com.company.inventory.library.service.impl;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.exception.ResourceNotFoundException;
import com.company.inventory.library.dto.request.IssueBookRequest;
import com.company.inventory.library.dto.request.ReturnBookRequest;
import com.company.inventory.library.dto.response.BookIssueResponse;
import com.company.inventory.library.dto.response.MostBorrowedBookResponse;
import com.company.inventory.library.entity.Book;
import com.company.inventory.library.entity.BookIssue;
import com.company.inventory.library.entity.BookStatus;
import com.company.inventory.library.entity.IssueStatus;
import com.company.inventory.library.entity.Member;
import com.company.inventory.library.mapper.BookIssueMapper;
import com.company.inventory.library.repository.BookIssueRepository;
import com.company.inventory.library.repository.BookRepository;
import com.company.inventory.library.repository.MemberRepository;
import com.company.inventory.library.service.BookIssueService;

/**
 * Issue/return workflow. Copy counts and issue records are updated together
 * inside one transaction (class-level {@link Transactional}); any failure rolls
 * back the whole operation so available-copy counts can never drift.
 */
@Service
@Transactional
public class BookIssueServiceImpl implements BookIssueService {

    private static final int DEFAULT_LOAN_DAYS = 14;

    private final BookIssueRepository bookIssueRepository;
    private final BookRepository bookRepository;
    private final MemberRepository memberRepository;
    private final BookIssueMapper bookIssueMapper;

    public BookIssueServiceImpl(BookIssueRepository bookIssueRepository,
                                BookRepository bookRepository,
                                MemberRepository memberRepository,
                                BookIssueMapper bookIssueMapper) {
        this.bookIssueRepository = bookIssueRepository;
        this.bookRepository = bookRepository;
        this.memberRepository = memberRepository;
        this.bookIssueMapper = bookIssueMapper;
    }

    @Override
    public BookIssueResponse issueBook(IssueBookRequest request, String username) {
        Book book = bookRepository.findById(request.getBookId())
                .orElseThrow(() -> new ResourceNotFoundException("Book not found with id " + request.getBookId()));
        Member member = memberRepository.findById(request.getMemberId())
                .orElseThrow(() -> new ResourceNotFoundException("Member not found with id " + request.getMemberId()));

        if (book.getStatus() != BookStatus.ACTIVE) {
            throw new IllegalArgumentException("'" + book.getTitle() + "' is not active and cannot be issued");
        }
        if (book.getAvailableCopies() == null || book.getAvailableCopies() < 1) {
            throw new IllegalArgumentException("No available copies of '" + book.getTitle() + "' to issue");
        }

        LocalDate issueDate = request.getIssueDate() != null ? request.getIssueDate() : LocalDate.now();
        LocalDate dueDate = request.getDueDate() != null ? request.getDueDate() : issueDate.plusDays(DEFAULT_LOAN_DAYS);
        if (dueDate.isBefore(issueDate)) {
            throw new IllegalArgumentException("Due date cannot be before the issue date");
        }

        // Reduce availability and record the loan atomically.
        book.setAvailableCopies(book.getAvailableCopies() - 1);
        bookRepository.save(book);

        BookIssue issue = BookIssue.builder()
                .book(book)
                .member(member)
                .issueDate(issueDate)
                .dueDate(dueDate)
                .status(IssueStatus.ISSUED)
                .issuedBy(username)
                .remarks(trim(request.getRemarks()))
                .build();
        BookIssue saved = bookIssueRepository.save(issue);
        return bookIssueMapper.toResponse(saved, LocalDate.now());
    }

    @Override
    public BookIssueResponse returnBook(ReturnBookRequest request, String username) {
        BookIssue issue = bookIssueRepository.findById(request.getIssueId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Issue record not found with id " + request.getIssueId()));

        if (issue.getStatus() == IssueStatus.RETURNED || issue.getReturnDate() != null) {
            throw new IllegalArgumentException("This book has already been returned");
        }

        LocalDate returnDate = request.getReturnDate() != null ? request.getReturnDate() : LocalDate.now();
        if (returnDate.isBefore(issue.getIssueDate())) {
            throw new IllegalArgumentException("Return date cannot be before the issue date");
        }

        // Restore availability, capped at total copies as a safety net.
        Book book = issue.getBook();
        int restored = Math.min(book.getAvailableCopies() + 1, book.getTotalCopies());
        book.setAvailableCopies(restored);
        bookRepository.save(book);

        issue.setReturnDate(returnDate);
        issue.setStatus(IssueStatus.RETURNED);
        if (request.getRemarks() != null && !request.getRemarks().isBlank()) {
            issue.setRemarks(request.getRemarks().trim());
        }
        BookIssue saved = bookIssueRepository.save(issue);
        return bookIssueMapper.toResponse(saved, LocalDate.now());
    }

    @Override
    @Transactional(readOnly = true)
    public BookIssueResponse getById(Long id) {
        BookIssue issue = bookIssueRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Issue record not found with id " + id));
        return bookIssueMapper.toResponse(issue, LocalDate.now());
    }

    @Override
    @Transactional(readOnly = true)
    public PagedResponse<BookIssueResponse> list(IssueStatus status, int page, int size, String sortBy, String sortDir) {
        LocalDate today = LocalDate.now();
        var pageable = LibrarySupport.pageable(page, size, sortBy, sortDir, "issueDate");
        Page<BookIssue> result;
        if (status == IssueStatus.OVERDUE) {
            result = bookIssueRepository.findOverdue(today, pageable);
        } else if (status != null) {
            result = bookIssueRepository.findByStatus(status, pageable);
        } else {
            result = bookIssueRepository.findAll(pageable);
        }
        return LibrarySupport.toPaged(result, issue -> bookIssueMapper.toResponse(issue, today));
    }

    @Override
    @Transactional(readOnly = true)
    public PagedResponse<BookIssueResponse> history(String keyword, IssueStatus status,
                                                    int page, int size, String sortBy, String sortDir) {
        LocalDate today = LocalDate.now();
        // OVERDUE is derived, so route it through the dedicated query.
        if (status == IssueStatus.OVERDUE) {
            Page<BookIssue> overdue = bookIssueRepository.findOverdue(
                    today, LibrarySupport.pageable(page, size, sortBy, sortDir, "issueDate"));
            return LibrarySupport.toPaged(overdue, issue -> bookIssueMapper.toResponse(issue, today));
        }
        Page<BookIssue> result = bookIssueRepository.searchHistory(
                emptyToNull(keyword), status,
                LibrarySupport.pageable(page, size, sortBy, sortDir, "issueDate"));
        return LibrarySupport.toPaged(result, issue -> bookIssueMapper.toResponse(issue, today));
    }

    @Override
    @Transactional(readOnly = true)
    public PagedResponse<BookIssueResponse> returnedReport(int page, int size) {
        LocalDate today = LocalDate.now();
        Page<BookIssue> result = bookIssueRepository.findReturned(
                LibrarySupport.pageable(page, size, "returnDate", "desc", "returnDate"));
        return LibrarySupport.toPaged(result, issue -> bookIssueMapper.toResponse(issue, today));
    }

    @Override
    @Transactional(readOnly = true)
    public PagedResponse<BookIssueResponse> overdueReport(int page, int size) {
        LocalDate today = LocalDate.now();
        Page<BookIssue> result = bookIssueRepository.findOverdue(
                today, LibrarySupport.pageable(page, size, "dueDate", "asc", "dueDate"));
        return LibrarySupport.toPaged(result, issue -> bookIssueMapper.toResponse(issue, today));
    }

    @Override
    @Transactional(readOnly = true)
    public List<MostBorrowedBookResponse> mostBorrowed(int limit) {
        int safeLimit = limit < 1 ? 10 : Math.min(limit, 100);
        List<Object[]> rows = bookIssueRepository.findMostBorrowed(PageRequest.of(0, safeLimit));
        return rows.stream().map(row -> MostBorrowedBookResponse.builder()
                .bookId(((Number) row[0]).longValue())
                .bookCode((String) row[1])
                .title((String) row[2])
                .author((String) row[3])
                .borrowCount(((Number) row[4]).longValue())
                .build()).toList();
    }

    private String emptyToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }

    private String trim(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
