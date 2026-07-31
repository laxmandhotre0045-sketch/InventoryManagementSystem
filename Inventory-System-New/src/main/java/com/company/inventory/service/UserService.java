package com.company.inventory.service;

import java.util.List;

import com.company.inventory.dto.request.CreateUserRequest;
import com.company.inventory.dto.response.UserResponse;
import com.company.inventory.entity.Role;

public interface UserService {

    List<UserResponse> list();

    UserResponse create(CreateUserRequest request);

    UserResponse updateRole(Long id, Role role);

    void delete(Long id, String currentUsernameOrEmail);
}
