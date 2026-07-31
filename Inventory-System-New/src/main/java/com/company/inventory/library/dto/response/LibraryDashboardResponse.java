package com.company.inventory.library.dto.response;

import java.util.List;

import lombok.Builder;
import lombok.Data;

/** Aggregated metrics and recent activity for the Library dashboard. */
@Data
@Builder
public class LibraryDashboardResponse {

    private long totalBooks;
    private long totalCopies;
    private long availableBooks;
    private long issuedBooks;
    private long overdueBooks;
    private long activeMembers;

    private List<BookIssueResponse> recentlyIssued;
    private List<BookIssueResponse> recentlyReturned;

    /** Distribution of books per category, for the dashboard chart. */
    private List<CategoryCount> booksByCategory;

    @Data
    @Builder
    public static class CategoryCount {
        private String category;
        private long count;
    }
}
