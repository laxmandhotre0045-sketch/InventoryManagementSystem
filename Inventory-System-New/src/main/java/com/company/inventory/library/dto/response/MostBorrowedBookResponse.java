package com.company.inventory.library.dto.response;

import lombok.Builder;
import lombok.Data;

/** A single row of the "Most Borrowed Books" report. */
@Data
@Builder
public class MostBorrowedBookResponse {

    private Long bookId;
    private String bookCode;
    private String title;
    private String author;
    private long borrowCount;
}
