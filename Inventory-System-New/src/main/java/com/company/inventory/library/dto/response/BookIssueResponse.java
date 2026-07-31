package com.company.inventory.library.dto.response;

import java.time.LocalDate;
import java.time.LocalDateTime;

import com.company.inventory.library.entity.IssueStatus;

import lombok.Builder;
import lombok.Data;

/**
 * Read model for a lending record. Book and member fields are flattened so the
 * UI needs no extra lookups. {@code effectiveStatus} reflects derived OVERDUE
 * (an active loan past its due date), while {@code status} is the stored value.
 */
@Data
@Builder
public class BookIssueResponse {

    private Long id;

    private Long bookId;
    private String bookCode;
    private String bookTitle;
    private String bookAuthor;

    private Long memberId;
    private String memberEmployeeId;
    private String memberName;
    private String memberDepartment;

    private LocalDate issueDate;
    private LocalDate dueDate;
    private LocalDate returnDate;

    private IssueStatus status;
    private IssueStatus effectiveStatus;
    private boolean overdue;
    /** Days overdue when active and past due; 0 otherwise. */
    private long daysOverdue;

    private String issuedBy;
    private String remarks;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
