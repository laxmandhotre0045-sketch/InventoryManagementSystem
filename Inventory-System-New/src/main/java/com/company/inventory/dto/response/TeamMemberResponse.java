package com.company.inventory.dto.response;

import java.time.LocalDateTime;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TeamMemberResponse {

    @Schema(description = "Team member identifier", example = "1")
    private Long id;

    @Schema(description = "Full name", example = "A. Patil")
    private String name;

    @Schema(description = "Job title", example = "Design Engineer")
    private String designation;

    @Schema(description = "Contact email", example = "a.patil@example.com")
    private String email;

    @Schema(description = "Contact phone", example = "+91 98765 43210")
    private String phone;

    @Schema(description = "Whether this member is offered when staffing a project", example = "true")
    private Boolean active;

    /**
     * How many projects currently list this person, as manager or as a team member.
     * Surfaced so Settings can warn before deactivating someone who is still staffed,
     * and so the delete guard has something to explain itself with.
     */
    @Schema(description = "Number of projects this member is assigned to", example = "3")
    private Long projectCount;

    @Schema(description = "Record created timestamp")
    private LocalDateTime createdAt;

    @Schema(description = "Record updated timestamp")
    private LocalDateTime updatedAt;
}
