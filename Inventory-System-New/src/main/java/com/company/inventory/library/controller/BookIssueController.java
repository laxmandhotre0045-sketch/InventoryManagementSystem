package com.company.inventory.library.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.company.inventory.dto.response.ApiResponse;
import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.library.dto.request.IssueBookRequest;
import com.company.inventory.library.dto.request.ReturnBookRequest;
import com.company.inventory.library.dto.response.BookIssueResponse;
import com.company.inventory.library.dto.response.MostBorrowedBookResponse;
import com.company.inventory.library.entity.IssueStatus;
import com.company.inventory.library.service.BookIssueService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/library/issues")
@Validated
@Tag(name = "Library — Issues", description = "Issue and return books, view lending records and reports")
public class BookIssueController {

    private final BookIssueService bookIssueService;

    public BookIssueController(BookIssueService bookIssueService) {
        this.bookIssueService = bookIssueService;
    }

    @Operation(summary = "Issue a book to a member")
    @PostMapping
    public ResponseEntity<ApiResponse<BookIssueResponse>> issue(@Valid @RequestBody IssueBookRequest request,
                                                                Authentication authentication) {
        String username = authentication != null ? authentication.getName() : "SYSTEM";
        BookIssueResponse response = bookIssueService.issueBook(request, username);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Book issued successfully", response));
    }

    @Operation(summary = "Return an issued book")
    @PostMapping("/return")
    public ResponseEntity<ApiResponse<BookIssueResponse>> returnBook(@Valid @RequestBody ReturnBookRequest request,
                                                                     Authentication authentication) {
        String username = authentication != null ? authentication.getName() : "SYSTEM";
        BookIssueResponse response = bookIssueService.returnBook(request, username);
        return ResponseEntity.ok(ApiResponse.success("Book returned successfully", response));
    }

    @Operation(summary = "Get an issue record by id")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<BookIssueResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Issue record retrieved successfully",
                bookIssueService.getById(id)));
    }

    @Operation(summary = "List lending records, optionally filtered by status")
    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<BookIssueResponse>>> list(
            @RequestParam(required = false) IssueStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "issueDate") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        PagedResponse<BookIssueResponse> response = bookIssueService.list(status, page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success("Lending records retrieved successfully", response));
    }

    @Operation(summary = "Full lending history with keyword + status filters")
    @GetMapping("/history")
    public ResponseEntity<ApiResponse<PagedResponse<BookIssueResponse>>> history(
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(required = false) IssueStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "issueDate") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        PagedResponse<BookIssueResponse> response = bookIssueService.history(keyword, status, page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success("Lending history retrieved successfully", response));
    }

    @Operation(summary = "Report: returned books")
    @GetMapping("/reports/returned")
    public ResponseEntity<ApiResponse<PagedResponse<BookIssueResponse>>> returnedReport(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success("Returned books retrieved successfully",
                bookIssueService.returnedReport(page, size)));
    }

    @Operation(summary = "Report: overdue books")
    @GetMapping("/reports/overdue")
    public ResponseEntity<ApiResponse<PagedResponse<BookIssueResponse>>> overdueReport(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success("Overdue books retrieved successfully",
                bookIssueService.overdueReport(page, size)));
    }

    @Operation(summary = "Report: most borrowed books")
    @GetMapping("/reports/most-borrowed")
    public ResponseEntity<ApiResponse<List<MostBorrowedBookResponse>>> mostBorrowed(
            @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(ApiResponse.success("Most borrowed books retrieved successfully",
                bookIssueService.mostBorrowed(limit)));
    }
}
