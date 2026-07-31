package com.company.inventory.library.service;

import java.util.List;

import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.library.dto.request.IssueBookRequest;
import com.company.inventory.library.dto.request.ReturnBookRequest;
import com.company.inventory.library.dto.response.BookIssueResponse;
import com.company.inventory.library.dto.response.MostBorrowedBookResponse;
import com.company.inventory.library.entity.IssueStatus;

public interface BookIssueService {

    /** Issue one copy of a book to a member (decrements available copies). */
    BookIssueResponse issueBook(IssueBookRequest request, String username);

    /** Record the return of an issued book (increments available copies). */
    BookIssueResponse returnBook(ReturnBookRequest request, String username);

    BookIssueResponse getById(Long id);

    /** Paged lending records, optionally filtered by status (ISSUED/RETURNED/OVERDUE). */
    PagedResponse<BookIssueResponse> list(IssueStatus status, int page, int size, String sortBy, String sortDir);

    /** Full lending history with keyword + status filters. */
    PagedResponse<BookIssueResponse> history(String keyword, IssueStatus status,
                                             int page, int size, String sortBy, String sortDir);

    PagedResponse<BookIssueResponse> returnedReport(int page, int size);

    PagedResponse<BookIssueResponse> overdueReport(int page, int size);

    List<MostBorrowedBookResponse> mostBorrowed(int limit);
}
