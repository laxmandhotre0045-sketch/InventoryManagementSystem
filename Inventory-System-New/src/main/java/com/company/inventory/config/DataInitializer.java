package com.company.inventory.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
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
// Must precede every other CommandLineRunner: this one carries the schema/data
// migrations, and ItemCodeBackfillRunner (@Order 20) loads ComponentItem entities.
// A row still holding a retired enum value would fail to convert and abort startup
// if the backfill ran first. Migrations go before anything that reads entities.
@Order(10)
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

    /**
     * Email of the single system owner. Defaults to the seeded admin address so an
     * existing deployment gains a master admin without extra configuration.
     */
    @Value("${app.seed.master-admin-email:${app.seed.admin-email:admin@inventory.com}}")
    private String masterAdminEmail;

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
        ensureMasterAdmin();

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
            // On a brand-new database the first seeded admin becomes the system owner;
            // once an owner exists, further seeded admins are ordinary admins.
            Role adminRole = userRepository.existsByRole(Role.MASTER_ADMIN) ? Role.ADMIN : Role.MASTER_ADMIN;
            seedUser(adminEmail, adminPassword, adminRole);
            seedUser(userEmail, userPassword, Role.USER);
        } catch (Exception ex) {
            log.error("Could not seed the configured accounts. The application will continue; "
                    + "sign in with an account that already exists, or fix SEED_ADMIN_EMAIL / "
                    + "SEED_ADMIN_PASSWORD and restart.", ex);
        }
    }

    /**
     * Guarantees exactly one MASTER_ADMIN exists.
     *
     * <p>Account management is master-admin-only, so a database that has none — every
     * database upgraded from before this role existed — would leave nobody able to
     * manage users at all. When none is present the configured owner address is
     * promoted in place (keeping its password and history); if that account does not
     * exist yet, the newest admin is promoted so the system is never left locked out.
     * Once an owner exists this is a no-op, so a later rename can never create a
     * second one.</p>
     */
    private void ensureMasterAdmin() {
        try {
            if (userRepository.existsByRole(Role.MASTER_ADMIN)) {
                return;
            }

            String target = masterAdminEmail == null ? "" : masterAdminEmail.trim();
            User owner = target.isEmpty() ? null : userRepository.findByEmail(target).orElse(null);

            if (owner == null) {
                owner = userRepository.findAll().stream()
                        .filter(u -> u.getRole() == Role.ADMIN)
                        .max((a, b) -> Long.compare(a.getId(), b.getId()))
                        .orElse(null);
            }

            if (owner == null) {
                log.info("No master admin and no admin to promote yet; the seeded admin will become the owner.");
                return;
            }

            owner.setRole(Role.MASTER_ADMIN);
            userRepository.save(owner);
            log.warn("Promoted {} to MASTER_ADMIN (system owner). Only this account can manage users.",
                    owner.getEmail());
        } catch (Exception ex) {
            log.error("Could not establish the master admin account. User management will be unavailable "
                    + "until one exists.", ex);
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

        // DISCONTINUED was removed from ComponentStatus (it behaved identically to
        // INACTIVE). Rows still holding it would fail to deserialise into the enum,
        // so fold them in before anything reads the table.
        try {
            int moved = jdbcTemplate.update("UPDATE components SET status = 'INACTIVE' WHERE status = 'DISCONTINUED'");
            if (moved > 0) {
                log.info("Migrated {} component(s) from DISCONTINUED to INACTIVE.", moved);
            }
        } catch (Exception ex) {
            log.debug("DISCONTINUED to INACTIVE migration skipped: {}", ex.getMessage());
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
