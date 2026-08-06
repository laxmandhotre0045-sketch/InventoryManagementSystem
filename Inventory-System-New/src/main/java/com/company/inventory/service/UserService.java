package com.company.inventory.service;

import java.util.List;

import com.company.inventory.dto.request.CreateUserRequest;
import com.company.inventory.dto.request.UpdateUserRequest;
import com.company.inventory.dto.response.UserResponse;
import com.company.inventory.entity.Role;

/**
 * Account management. Every mutating method is reserved for the master admin —
 * the controller enforces that with {@code @PreAuthorize}, and the implementation
 * re-checks the account-level invariants (single master admin, master admin is
 * immutable to others, no self-destructive actions) so the rules hold regardless
 * of how the service is called.
 */
public interface UserService {

    List<UserResponse> list();

    UserResponse create(CreateUserRequest request);

    UserResponse update(Long id, UpdateUserRequest request, String actingEmail);

    UserResponse updateRole(Long id, Role role, String actingEmail);

    UserResponse setActive(Long id, boolean active, String actingEmail);

    void resetPassword(Long id, String newPassword);

    void delete(Long id, String currentUsernameOrEmail);
}
