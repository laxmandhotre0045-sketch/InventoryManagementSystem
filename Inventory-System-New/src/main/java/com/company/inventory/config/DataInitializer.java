package com.company.inventory.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.company.inventory.entity.Role;
import com.company.inventory.entity.User;
import com.company.inventory.repository.UserRepository;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbcTemplate;

    public DataInitializer(UserRepository userRepository,
                           PasswordEncoder passwordEncoder,
                           JdbcTemplate jdbcTemplate) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        migrateRoleColumn();
        seedUser("admin", "admin@inventory.com", "admin123", Role.ADMIN);
        seedUser("user", "user@inventory.com", "user123", Role.USER);
    }

    private void migrateRoleColumn() {
        try {
            jdbcTemplate.execute("ALTER TABLE users MODIFY COLUMN role VARCHAR(32) NOT NULL");
        } catch (Exception ex) {
            log.debug("Role column migration skipped: {}", ex.getMessage());
        }

        try {
            jdbcTemplate.update("UPDATE users SET role = 'USER' WHERE role = 'EMPLOYEE'");
        } catch (Exception ex) {
            log.debug("EMPLOYEE to USER migration skipped: {}", ex.getMessage());
        }
    }

    private void seedUser(String username, String email, String password, Role role) {
        if (!userRepository.existsByEmail(email)) {
            userRepository.save(User.builder()
                    .username(username)
                    .email(email)
                    .password(passwordEncoder.encode(password))
                    .role(role)
                    .build());
            log.info("Seeded {} user: {}", role, email);
        }
    }
}
