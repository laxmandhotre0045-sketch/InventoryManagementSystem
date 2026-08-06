package com.company.inventory.service.impl;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.company.inventory.dto.request.CreateUserRequest;
import com.company.inventory.dto.request.UpdateUserRequest;
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
                .sorted((a, b) -> {
                    // Master admin first, then admins, then by id — the owner account
                    // should always be the first row in the management table.
                    int byRole = Integer.compare(a.getRole().ordinal(), b.getRole().ordinal());
                    return byRole != 0 ? byRole : Long.compare(a.getId(), b.getId());
                })
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    public UserResponse create(CreateUserRequest request) {
        rejectMasterAdminRole(request.getRole());

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
                .active(Boolean.TRUE)
                .build();
        return toResponse(userRepository.save(user));
    }

    @Override
    public UserResponse update(Long id, UpdateUserRequest request, String actingEmail) {
        User user = require(id);
        // The owner account may edit its own name/email, but nobody else can touch it,
        // and its role can never move away from MASTER_ADMIN. Note the role check is
        // split: the owner legitimately submits its own current role back, so a blanket
        // "MASTER_ADMIN is never accepted" rule would block the owner editing itself.
        if (user.getRole() == Role.MASTER_ADMIN) {
            requireSelf(user, actingEmail, "The master admin account can only be edited by itself");
            if (request.getRole() != Role.MASTER_ADMIN) {
                throw new ResourceInUseException("The master admin role cannot be changed");
            }
        } else {
            rejectMasterAdminRole(request.getRole());
        }

        String email = request.getEmail().trim().toLowerCase();
        if (!email.equalsIgnoreCase(user.getEmail()) && userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("A user with email '" + email + "' already exists");
        }
        String username = request.getUsername().trim();
        if (!username.equalsIgnoreCase(user.getUsername()) && userRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("A user with name '" + username + "' already exists");
        }

        if (user.getRole() != Role.MASTER_ADMIN) {
            guardLastAdmin(user, request.getRole());
            user.setRole(request.getRole());
        }
        user.setUsername(username);
        user.setEmail(email);
        return toResponse(userRepository.save(user));
    }

    @Override
    public UserResponse updateRole(Long id, Role role, String actingEmail) {
        User user = require(id);
        rejectMasterAdminRole(role);
        if (user.getRole() == Role.MASTER_ADMIN) {
            throw new ResourceInUseException("The master admin role cannot be changed");
        }
        guardLastAdmin(user, role);
        user.setRole(role);
        return toResponse(userRepository.save(user));
    }

    @Override
    public UserResponse setActive(Long id, boolean active, String actingEmail) {
        User user = require(id);
        if (user.getRole() == Role.MASTER_ADMIN) {
            throw new ResourceInUseException("The master admin account cannot be deactivated");
        }
        if (!active && isSelf(user, actingEmail)) {
            throw new ResourceInUseException("You cannot deactivate your own account");
        }
        user.setActive(active);
        return toResponse(userRepository.save(user));
    }

    @Override
    public void resetPassword(Long id, String newPassword) {
        User user = require(id);
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    @Override
    public void delete(Long id, String currentUsernameOrEmail) {
        User user = require(id);
        if (user.getRole() == Role.MASTER_ADMIN) {
            throw new ResourceInUseException("The master admin account cannot be deleted");
        }
        if (isSelf(user, currentUsernameOrEmail)) {
            throw new ResourceInUseException("You cannot delete your own account");
        }
        userRepository.delete(user);
    }

    // ---- invariants ---------------------------------------------------------

    /**
     * MASTER_ADMIN is never assignable through the API — not on create, not on edit.
     * That is what stops a second owner appearing and stops anyone promoting themselves;
     * the single master admin is established once, at bootstrap, by DataInitializer.
     */
    private void rejectMasterAdminRole(Role role) {
        if (role == Role.MASTER_ADMIN) {
            throw new ResourceInUseException(
                    "The master admin role cannot be assigned. There is exactly one master admin.");
        }
    }

    /** Keeps at least one account able to administer the system. */
    private void guardLastAdmin(User user, Role newRole) {
        if (user.getRole() == Role.ADMIN && newRole != Role.ADMIN
                && userRepository.countByRole(Role.ADMIN) <= 1
                && !userRepository.existsByRole(Role.MASTER_ADMIN)) {
            throw new ResourceInUseException("Cannot change the role of the last remaining administrator");
        }
    }

    private User require(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id " + id));
    }

    private boolean isSelf(User user, String usernameOrEmail) {
        return usernameOrEmail != null
                && (usernameOrEmail.equalsIgnoreCase(user.getEmail())
                    || usernameOrEmail.equalsIgnoreCase(user.getUsername()));
    }

    private void requireSelf(User user, String actingEmail, String message) {
        if (!isSelf(user, actingEmail)) {
            throw new ResourceInUseException(message);
        }
    }

    private UserResponse toResponse(User u) {
        return UserResponse.builder()
                .id(u.getId())
                .username(u.getUsername())
                .email(u.getEmail())
                .role(u.getRole())
                .active(u.isEnabled())
                .masterAdmin(u.getRole() == Role.MASTER_ADMIN)
                .createdAt(u.getCreatedAt())
                .build();
    }
}
