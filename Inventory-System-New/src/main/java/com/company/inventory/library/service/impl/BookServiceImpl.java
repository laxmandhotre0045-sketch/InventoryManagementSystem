package com.company.inventory.library.service.impl;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.exception.ResourceInUseException;
import com.company.inventory.exception.ResourceNotFoundException;
import com.company.inventory.library.dto.request.BookRequest;
import com.company.inventory.library.dto.response.BookResponse;
import com.company.inventory.library.entity.Book;
import com.company.inventory.library.entity.BookStatus;
import com.company.inventory.library.entity.IssueStatus;
import com.company.inventory.library.mapper.BookMapper;
import com.company.inventory.library.repository.BookIssueRepository;
import com.company.inventory.library.repository.BookRepository;
import com.company.inventory.library.service.BookCodeGenerator;
import com.company.inventory.library.service.BookService;

@Service
@Transactional
public class BookServiceImpl implements BookService {

    private final BookRepository bookRepository;
    private final BookIssueRepository bookIssueRepository;
    private final BookMapper bookMapper;
    private final BookCodeGenerator bookCodeGenerator;

    public BookServiceImpl(BookRepository bookRepository,
                           BookIssueRepository bookIssueRepository,
                           BookMapper bookMapper,
                           BookCodeGenerator bookCodeGenerator) {
        this.bookRepository = bookRepository;
        this.bookIssueRepository = bookIssueRepository;
        this.bookMapper = bookMapper;
        this.bookCodeGenerator = bookCodeGenerator;
    }

    @Override
    public BookResponse create(BookRequest request) {
        Book book = new Book();
        bookMapper.applyEditableFields(request, book);
        book.setBookCode(bookCodeGenerator.nextCode());
        int total = request.getTotalCopies();
        book.setTotalCopies(total);
        book.setAvailableCopies(total);
        if (book.getStatus() == null) {
            book.setStatus(BookStatus.ACTIVE);
        }
        Book saved = bookRepository.save(book);
        return bookMapper.toResponse(saved);
    }

    @Override
    public BookResponse update(Long id, BookRequest request) {
        Book book = findBook(id);
        int issued = Math.max(0, book.getTotalCopies() - book.getAvailableCopies());

        bookMapper.applyEditableFields(request, book);

        int newTotal = request.getTotalCopies();
        if (newTotal < issued) {
            throw new IllegalArgumentException(
                    "Total copies cannot be less than the " + issued + " copy(ies) currently issued");
        }
        // Preserve issued count; available absorbs the change in total.
        book.setTotalCopies(newTotal);
        book.setAvailableCopies(newTotal - issued);

        Book saved = bookRepository.save(book);
        return bookMapper.toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public BookResponse getById(Long id) {
        return bookMapper.toResponse(findBook(id));
    }

    @Override
    public void delete(Long id) {
        Book book = findBook(id);
        if (bookIssueRepository.existsByBookIdAndStatus(id, IssueStatus.ISSUED)) {
            throw new ResourceInUseException(
                    "Cannot delete '" + book.getTitle() + "' while copies are still issued");
        }
        bookRepository.delete(book);
    }

    @Override
    @Transactional(readOnly = true)
    public PagedResponse<BookResponse> search(String keyword, String category, BookStatus status,
                                              int page, int size, String sortBy, String sortDir) {
        Page<Book> result = bookRepository.search(
                emptyToNull(keyword), emptyToNull(category), status,
                LibrarySupport.pageable(page, size, sortBy, sortDir, "createdAt"));
        return LibrarySupport.toPaged(result, bookMapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> categories() {
        return bookRepository.findDistinctCategories();
    }

    private Book findBook(Long id) {
        return bookRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Book not found with id " + id));
    }

    private String emptyToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }
}
