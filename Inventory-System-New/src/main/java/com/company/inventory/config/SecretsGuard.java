package com.company.inventory.config;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;

/**
 * Refuses to start the "prod" profile with a placeholder JWT signing key.
 *
 * <p>The signing key is the whole of the authentication system: anyone who knows it
 * can mint a token for any email with the ADMIN role. The values below are the ones
 * shipped in this repository's properties and {@code .env.example}, so they must be
 * assumed public. Booting a server with one of them is a silent full compromise —
 * failing loudly at startup is the only safe behaviour.</p>
 *
 * <p>Only active under the prod profile; local development is untouched.</p>
 */
@Slf4j
@Profile("prod")
@Configuration
public class SecretsGuard {

    /** Signing keys published in this repo. Never valid on a deployed server. */
    private static final List<String> PUBLISHED_SECRETS = List.of(
            "local-dev-only-insecure-secret-please-override",
            "change_me_to_a_long_random_secret_key_at_least_32_chars",
            "mysupersecretkeyforjwtsigningdontuseinproduction");

    /** HS256 needs at least a 256-bit key. */
    private static final int MIN_SECRET_BYTES = 32;

    @Value("${inventory.jwt.secret:}")
    private String jwtSecret;

    @Value("${app.seed.default-users:false}")
    private boolean seedDefaultUsers;

    @Value("${app.seed.admin-password:}")
    private String seedAdminPassword;

    @PostConstruct
    void verify() {
        String secret = jwtSecret == null ? "" : jwtSecret.trim();

        if (secret.isEmpty() || PUBLISHED_SECRETS.contains(secret.toLowerCase(Locale.ROOT))) {
            throw new IllegalStateException(
                    "JWT_SECRET is unset or still one of the example values published in this repository. "
                    + "Anyone could forge an admin token. Set JWT_SECRET in .env to a long random string "
                    + "(e.g. `openssl rand -base64 48`) before starting the prod profile.");
        }

        if (secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
            throw new IllegalStateException(
                    "JWT_SECRET must be at least " + MIN_SECRET_BYTES
                    + " bytes for HS256 signing. Generate one with `openssl rand -base64 48`.");
        }

        if (seedDefaultUsers && "admin123".equals(seedAdminPassword)) {
            log.warn("""

                    ***********************************************************************
                    * SEED_DEFAULT_USERS is on and the admin password is still "admin123". *
                    * Change SEED_ADMIN_PASSWORD, or set SEED_DEFAULT_USERS=false once the *
                    * real admin account exists.                                           *
                    ***********************************************************************""");
        }
    }
}
