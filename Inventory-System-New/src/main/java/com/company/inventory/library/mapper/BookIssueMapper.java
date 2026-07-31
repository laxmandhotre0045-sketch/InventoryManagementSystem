package com.company.inventory.library.mapper;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

import org.springframework.stereotype.Component;

import com.company.inventory.library.dto.response.BookIssueResponse;
import com.company.inventory.library.entity.BookIssue;
import com.company.inventory.library.entity.IssueStatus;

/** Maps {@link BookIssue} entities to their read model, deriving overdue state. */
@Component
public class BookIssueMapper {

    public BookIssueResponse toResponse(BookIssue issue, LocalDate today) {
        boolean overdue = issue.getStatus() == IssueStatus.ISSUED
                && issue.getDueDate() != null
                && issue.getDueDate().isBefore(today);
        long daysOverdue = overdue ? ChronoUnit.DAYS.between(issue.getDueDate(), today) : 0L;
        IssueStatus effective = overdue ? IssueStatus.OVERDUE : issue.getStatus();

        return BookIssueResponse.builder()
                .id(issue.getId())
                .bookId(issue.getBook() != null ? issue.getBook().getId() : null)
                .bookCode(issue.getBook() != null ? issue.getBook().getBookCode() : null)
                .bookTitle(issue.getBook() != null ? issue.getBook().getTitle() : null)
                .bookAuthor(issue.getBook() != null ? issue.getBook().getAuthor() : null)
                .memberId(issue.getMember() != null ? issue.getMember().getId() : null)
                .memberEmployeeId(issue.getMember() != null ? issue.getMember().getEmployeeId() : null)
                .memberName(issue.getMember() != null ? issue.getMember().getName() : null)
                .memberDepartment(issue.getMember() != null ? issue.getMember().getDepartment() : null)
                .issueDate(issue.getIssueDate())
                .dueDate(issue.getDueDate())
                .returnDate(issue.getReturnDate())
                .status(issue.getStatus())
                .effectiveStatus(effective)
                .overdue(overdue)
                .daysOverdue(daysOverdue)
                .issuedBy(issue.getIssuedBy())
                .remarks(issue.getRemarks())
                .createdAt(issue.getCreatedAt())
                .updatedAt(issue.getUpdatedAt())
                .build();
    }
}
