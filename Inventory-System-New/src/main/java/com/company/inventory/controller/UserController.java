package com.company.inventory.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.company.inventory.dto.request.CreateUserRequest;
import com.company.inventory.dto.request.ResetPasswordRequest;
import com.company.inventory.dto.request.SetActiveRequest;
import com.company.inventory.dto.request.UpdateUserRequest;
import com.company.inventory.dto.request.UpdateUserRoleRequest;
import com.company.inventory.dto.response.ApiResponse;
import com.company.inventory.dto.response.UserResponse;
import com.company.inventory.service.UserService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/**
 * Account &amp; role management — reserved for the master admin.
 *
 * <p>The class-level {@code @PreAuthorize} is the authoritative check: a plain ADMIN
 * receives 403 on every endpoint here, so admins cannot create, edit, suspend, delete
 * or re-role each other, nor promote themselves. Hiding the screen in the UI is only a
 * convenience layered on top of this.</p>
 */
@RestController
@RequestMapping("/users")
@PreAuthorize("hasRole('MASTER_ADMIN')")
@Tag(name = "User Management", description = "Master-admin only: manage user accounts and roles")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @Operation(summary = "List all users")
    @GetMapping
    public ResponseEntity<ApiResponse<List<UserResponse>>> list() {
        return ResponseEntity.ok(ApiResponse.success("Users retrieved successfully", userService.list()));
    }

    @Operation(summary = "Create a user (ADMIN or USER — the master admin role cannot be assigned)")
    @PostMapping
    public ResponseEntity<ApiResponse<UserResponse>> create(@Valid @RequestBody CreateUserRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("User created successfully", userService.create(request)));
    }

    @Operation(summary = "Edit a user's name, email and role")
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<UserResponse>> update(@PathVariable Long id,
                                                            @Valid @RequestBody UpdateUserRequest request,
                                                            Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.success("User updated successfully",
                userService.update(id, request, nameOf(authentication))));
    }

    @Operation(summary = "Update a user's role")
    @PutMapping("/{id}/role")
    public ResponseEntity<ApiResponse<UserResponse>> updateRole(@PathVariable Long id,
                                                                @Valid @RequestBody UpdateUserRoleRequest request,
                                                                Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.success("User role updated successfully",
                userService.updateRole(id, request.getRole(), nameOf(authentication))));
    }

    @Operation(summary = "Activate or deactivate a user")
    @PutMapping("/{id}/active")
    public ResponseEntity<ApiResponse<UserResponse>> setActive(@PathVariable Long id,
                                                               @Valid @RequestBody SetActiveRequest request,
                                                               Authentication authentication) {
        UserResponse updated = userService.setActive(id, request.getActive(), nameOf(authentication));
        return ResponseEntity.ok(ApiResponse.success(
                Boolean.TRUE.equals(request.getActive()) ? "User activated" : "User deactivated", updated));
    }

    @Operation(summary = "Reset a user's password")
    @PutMapping("/{id}/password")
    public ResponseEntity<ApiResponse<Void>> resetPassword(@PathVariable Long id,
                                                           @Valid @RequestBody ResetPasswordRequest request) {
        userService.resetPassword(id, request.getPassword());
        return ResponseEntity.ok(ApiResponse.success("Password reset successfully", null));
    }

    @Operation(summary = "Delete a user")
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id, Authentication authentication) {
        userService.delete(id, nameOf(authentication));
        return ResponseEntity.ok(ApiResponse.success("User deleted successfully", null));
    }

    private String nameOf(Authentication authentication) {
        return authentication != null ? authentication.getName() : null;
    }
}
