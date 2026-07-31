package com.company.inventory.library.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.company.inventory.dto.response.ApiResponse;
import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.library.dto.request.BookRequest;
import com.company.inventory.library.dto.response.BookResponse;
import com.company.inventory.library.entity.BookStatus;
import com.company.inventory.library.service.BookService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/**
 * Book catalogue endpoints for the Library module.
 *
 * <p>The full {@code /api/v1/library} path is declared explicitly here because this
 * controller lives outside {@code com.company.inventory.controller} and is therefore
 * not touched by the Inventory {@code ApiVersionConfig} path-prefixing.</p>
 */
@RestController
@RequestMapping("/api/v1/library/books")
@Validated
@Tag(name = "Library — Books", description = "Manage the library book catalogue")
public class BookController {

    private final BookService bookService;

    public BookController(BookService bookService) {
        this.bookService = bookService;
    }

    @Operation(summary = "Create a book (book code auto-generated)")
    @PostMapping
    public ResponseEntity<ApiResponse<BookResponse>> create(@Valid @RequestBody BookRequest request) {
        BookResponse response = bookService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Book created successfully", response));
    }

    @Operation(summary = "Update a book")
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<BookResponse>> update(@PathVariable Long id,
                                                            @Valid @RequestBody BookRequest request) {
        BookResponse response = bookService.update(id, request);
        return ResponseEntity.ok(ApiResponse.success("Book updated successfully", response));
    }

    @Operation(summary = "Get a book by id")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<BookResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Book retrieved successfully", bookService.getById(id)));
    }

    @Operation(summary = "Search / list books with filters and pagination")
    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<BookResponse>>> search(
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) BookStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        PagedResponse<BookResponse> response = bookService.search(keyword, category, status, page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success("Books retrieved successfully", response));
    }

    @Operation(summary = "List distinct book categories (for filters)")
    @GetMapping("/categories")
    public ResponseEntity<ApiResponse<List<String>>> categories() {
        return ResponseEntity.ok(ApiResponse.success("Categories retrieved successfully", bookService.categories()));
    }

    @Operation(summary = "Delete a book")
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        bookService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Book deleted successfully", null));
    }
}
