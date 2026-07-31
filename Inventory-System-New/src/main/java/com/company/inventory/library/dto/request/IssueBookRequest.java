package com.company.inventory.library.dto.request;

import java.time.LocalDate;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Payload to issue one copy of a book to a member. {@code issueDate} defaults to
 * today and {@code dueDate} defaults to two weeks out when omitted; {@code issuedBy}
 * is taken from the authenticated user server-side.
 */
@Data
public class IssueBookRequest {

    @NotNull(message = "Book is required")
    private Long bookId;

    @NotNull(message = "Member is required")
    private Long memberId;

    private LocalDate issueDate;

    private LocalDate dueDate;

    @Size(max = 500, message = "Remarks must be at most 500 characters")
    private String remarks;
}
