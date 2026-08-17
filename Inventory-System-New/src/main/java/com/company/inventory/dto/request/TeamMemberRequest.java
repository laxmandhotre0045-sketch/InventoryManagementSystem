package com.company.inventory.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class TeamMemberRequest {

    @Schema(description = "Full name, unique across the team roster", example = "A. Patil")
    @NotBlank(message = "Name is required")
    @Size(max = 120, message = "Name must be at most 120 characters")
    private String name;

    @Schema(description = "Job title shown beside the name when staffing a project", example = "Design Engineer")
    @Size(max = 120, message = "Designation must be at most 120 characters")
    private String designation;

    @Schema(description = "Contact email", example = "a.patil@example.com")
    @Email(message = "Email must be a valid address")
    @Size(max = 150, message = "Email must be at most 150 characters")
    private String email;

    @Schema(description = "Contact phone", example = "+91 98765 43210")
    @Size(max = 30, message = "Phone must be at most 30 characters")
    private String phone;

    /**
     * Optional so an older client that omits it keeps working: the service treats a null
     * as "active", which is also what a newly added member should be.
     */
    @Schema(description = "Whether this member is offered when staffing a project", example = "true")
    private Boolean active;
}
