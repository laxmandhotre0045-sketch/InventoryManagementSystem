package com.company.inventory.library.service;

import java.util.List;

import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.library.dto.request.BookRequest;
import com.company.inventory.library.dto.response.BookResponse;
import com.company.inventory.library.entity.BookStatus;

public interface BookService {

    BookResponse create(BookRequest request);

    BookResponse update(Long id, BookRequest request);

    BookResponse getById(Long id);

    void delete(Long id);

    PagedResponse<BookResponse> search(String keyword, String category, BookStatus status,
                                       int page, int size, String sortBy, String sortDir);

    List<String> categories();
}
