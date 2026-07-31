package com.company.inventory.library.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** Payload for creating or updating a library member. */
@Data
public class MemberRequest {

    @NotBlank(message = "Employee ID is required")
    @Size(max = 40, message = "Employee ID must be at most 40 characters")
    private String employeeId;

    @NotBlank(message = "Name is required")
    @Size(max = 150, message = "Name must be at most 150 characters")
    private String name;

    @Size(max = 120)
    private String department;

    @Email(message = "Email must be valid")
    @Size(max = 150)
    private String email;

    @Size(max = 30, message = "Phone must be at most 30 characters")
    private String phone;
}
