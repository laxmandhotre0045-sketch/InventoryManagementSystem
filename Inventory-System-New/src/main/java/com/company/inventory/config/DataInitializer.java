package com.company.inventory.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.company.inventory.entity.Role;
import com.company.inventory.entity.User;
import com.company.inventory.repository.UserRepository;

import lombok.extern.slf4j.Slf4j;

/**
 * First-boot bootstrap.
 *
 * <p>The schema migrations always run. Seeding the built-in admin/user accounts is
 * opt-in via {@code app.seed.default-users} (SEED_DEFAULT_USERS) — enabled for local
 * development, disabled under the "prod" profile — so the well-known demo credentials
 * can never be created silently on a deployed server. The seeded email/password are
 * themselves overridable so a real first admin can be provisioned from the
 * environment instead.</p>
 */
@Slf4j
@Component
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbcTemplate;

    @Value("${app.seed.default-users:true}")
    private boolean seedDefaultUsers;

    @Value("${app.seed.admin-email:admin@inventory.com}")
    private String adminEmail;

    @Value("${app.seed.admin-password:admin123}")
    private String adminPassword;

    @Value("${app.seed.user-email:user@inventory.com}")
    private String userEmail;

    @Value("${app.seed.user-password:user123}")
    private String userPassword;

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

        if (!seedDefaultUsers) {
            log.info("Default user seeding is disabled (app.seed.default-users=false).");
            if (userRepository.count() == 0) {
                log.warn("No user accounts exist. Set SEED_DEFAULT_USERS=true together with "
                        + "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD for one boot to create the first admin.");
            }
            return;
        }

        // Seeding is a convenience, never a startup requirement. A failure here must not
        // stop the application: the existing accounts in the database are still valid and
        // users must be able to sign in with them.
        try {
            seedUser(adminEmail, adminPassword, Role.ADMIN);
            seedUser(userEmail, userPassword, Role.USER);
        } catch (Exception ex) {
            log.error("Could not seed the configured accounts. The application will continue; "
                    + "sign in with an account that already exists, or fix SEED_ADMIN_EMAIL / "
                    + "SEED_ADMIN_PASSWORD and restart.", ex);
        }
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

    private void seedUser(String email, String password, Role role) {
        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            log.debug("Skipped seeding the {} account: email or password is blank.", role);
            return;
        }

        String normalisedEmail = email.trim();
        if (userRepository.existsByEmail(normalisedEmail)) {
            log.info("{} account {} already exists — leaving it untouched.", role, normalisedEmail);
            return;
        }

        userRepository.save(User.builder()
                .username(uniqueUsernameFor(normalisedEmail))
                .email(normalisedEmail)
                .password(passwordEncoder.encode(password))
                .role(role)
                .build());
        log.info("Seeded {} account: {}", role, normalisedEmail);
    }

    /**
     * Derives a free username from the email's local part.
     *
     * <p>{@code users.username} is UNIQUE, so a fixed literal like "admin" collides as soon as
     * a differently-named admin is seeded into a database that already holds the original one —
     * which fails the insert and, before this was handled, took the whole application down with
     * it. Suffixes are appended until a free name is found.</p>
     */
    private String uniqueUsernameFor(String email) {
        int at = email.indexOf('@');
        String base = (at > 0 ? email.substring(0, at) : email).replaceAll("[^A-Za-z0-9._-]", "");
        if (base.isBlank()) {
            base = "user";
        }
        if (base.length() > 70) {
            base = base.substring(0, 70);
        }

        if (!userRepository.existsByUsername(base)) {
            return base;
        }
        for (int suffix = 2; suffix < 1000; suffix++) {
            String candidate = base + suffix;
            if (!userRepository.existsByUsername(candidate)) {
                return candidate;
            }
        }
        return base + System.currentTimeMillis();
    }
}
