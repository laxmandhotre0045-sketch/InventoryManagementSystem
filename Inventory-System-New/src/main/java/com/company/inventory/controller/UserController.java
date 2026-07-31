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
import com.company.inventory.dto.request.UpdateUserRoleRequest;
import com.company.inventory.dto.response.ApiResponse;
import com.company.inventory.dto.response.UserResponse;
import com.company.inventory.service.UserService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/** Admin-only user & role management (part of the Settings module). */
@RestController
@RequestMapping("/users")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "User Management", description = "Manage user accounts and roles")
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

    @Operation(summary = "Create a user")
    @PostMapping
    public ResponseEntity<ApiResponse<UserResponse>> create(@Valid @RequestBody CreateUserRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("User created successfully", userService.create(request)));
    }

    @Operation(summary = "Update a user's role")
    @PutMapping("/{id}/role")
    public ResponseEntity<ApiResponse<UserResponse>> updateRole(@PathVariable Long id,
                                                                @Valid @RequestBody UpdateUserRoleRequest request) {
        return ResponseEntity.ok(ApiResponse.success("User role updated successfully",
                userService.updateRole(id, request.getRole())));
    }

    @Operation(summary = "Delete a user")
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id, Authentication authentication) {
        String current = authentication != null ? authentication.getName() : null;
        userService.delete(id, current);
        return ResponseEntity.ok(ApiResponse.success("User deleted successfully", null));
    }
}
