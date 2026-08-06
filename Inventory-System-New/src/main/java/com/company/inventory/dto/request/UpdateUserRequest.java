package com.company.inventory.dto.request;

import com.company.inventory.entity.Role;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** Payload for the master admin to edit an existing account. Password is changed separately. */
@Data
public class UpdateUserRequest {

    @NotBlank(message = "Name is required")
    @Size(max = 100)
    private String username;

    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    private String email;

    @NotNull(message = "Role is required")
    private Role role;
}
