package com.company.inventory.service.impl;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.company.inventory.dto.request.CreateUserRequest;
import com.company.inventory.dto.response.UserResponse;
import com.company.inventory.entity.Role;
import com.company.inventory.entity.User;
import com.company.inventory.exception.ResourceInUseException;
import com.company.inventory.exception.ResourceNotFoundException;
import com.company.inventory.repository.UserRepository;
import com.company.inventory.service.UserService;

@Service
@Transactional
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserServiceImpl(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserResponse> list() {
        return userRepository.findAll().stream()
                .sorted((a, b) -> Long.compare(a.getId(), b.getId()))
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    public UserResponse create(CreateUserRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("A user with email '" + email + "' already exists");
        }
        String username = request.getUsername().trim();
        if (userRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("A user with name '" + username + "' already exists");
        }
        User user = User.builder()
                .username(username)
                .email(email)
                .password(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole())
                .build();
        return toResponse(userRepository.save(user));
    }

    @Override
    public UserResponse updateRole(Long id, Role role) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id " + id));
        // Prevent demoting the last remaining admin.
        if (user.getRole() == Role.ADMIN && role != Role.ADMIN && countAdmins() <= 1) {
            throw new ResourceInUseException("Cannot change the role of the last remaining administrator");
        }
        user.setRole(role);
        return toResponse(userRepository.save(user));
    }

    @Override
    public void delete(Long id, String currentUsernameOrEmail) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id " + id));
        if (currentUsernameOrEmail != null
                && (currentUsernameOrEmail.equalsIgnoreCase(user.getEmail())
                    || currentUsernameOrEmail.equalsIgnoreCase(user.getUsername()))) {
            throw new ResourceInUseException("You cannot delete your own account");
        }
        if (user.getRole() == Role.ADMIN && countAdmins() <= 1) {
            throw new ResourceInUseException("Cannot delete the last remaining administrator");
        }
        userRepository.delete(user);
    }

    private long countAdmins() {
        return userRepository.findAll().stream().filter(u -> u.getRole() == Role.ADMIN).count();
    }

    private UserResponse toResponse(User u) {
        return UserResponse.builder()
                .id(u.getId())
                .username(u.getUsername())
                .email(u.getEmail())
                .role(u.getRole())
                .createdAt(u.getCreatedAt())
                .build();
    }
}
