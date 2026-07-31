package com.company.inventory.library.dto.response;

import java.time.LocalDateTime;

import lombok.Builder;
import lombok.Data;

/** Read model for a library member. */
@Data
@Builder
public class MemberResponse {

    private Long id;
    private String employeeId;
    private String name;
    private String department;
    private String email;
    private String phone;
    /** Number of books this member currently holds (active loans). */
    private Long activeIssues;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
