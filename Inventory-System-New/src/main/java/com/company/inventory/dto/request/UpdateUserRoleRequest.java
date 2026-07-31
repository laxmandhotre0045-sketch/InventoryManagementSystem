package com.company.inventory.dto.request;

import com.company.inventory.entity.Role;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

/** Payload to change a user's role. */
@Data
public class UpdateUserRoleRequest {

    @NotNull(message = "Role is required")
    private Role role;
}
