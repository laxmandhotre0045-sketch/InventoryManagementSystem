package com.company.inventory.repository;

import com.company.inventory.entity.Role;
import com.company.inventory.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    Optional<User> findByUsername(String username);
    boolean existsByEmail(String email);
    boolean existsByUsername(String username);

    Optional<User> findFirstByRole(Role role);
    long countByRole(Role role);
    boolean existsByRole(Role role);
}
