package com.company.inventory.dto.response;

import java.time.LocalDateTime;

import com.company.inventory.entity.Role;

import lombok.Builder;
import lombok.Data;

/** Read model for a user account (never exposes the password hash). */
@Data
@Builder
public class UserResponse {

    private Long id;
    private String username;
    private String email;
    private Role role;
    private LocalDateTime createdAt;
}
