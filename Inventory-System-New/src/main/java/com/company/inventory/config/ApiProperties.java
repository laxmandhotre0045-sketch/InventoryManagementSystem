package com.company.inventory.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Single source of truth for the public API path prefix.
 *
 * Configured in application.properties:
 *   api.base-path=/api
 *   api.version=v1
 *
 * Changing {@code api.version} (or {@code api.base-path}) here updates the prefix
 * everywhere it is used — controller mappings, security rules, and the JWT filter —
 * without touching any @RequestMapping.
 */
@Component
@ConfigurationProperties(prefix = "api")
public class ApiProperties {

    /** Root path for all API endpoints. */
    private String basePath = "/api";

    /** Current API version segment, e.g. "v1". Leave blank to disable versioning. */
    private String version = "v1";

    public String getBasePath() {
        return basePath;
    }

    public void setBasePath(String basePath) {
        this.basePath = basePath;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    /**
     * The effective, normalized prefix applied to every controller, e.g. "/api/v1".
     * Leading/trailing slashes are normalized so the properties are forgiving.
     */
    public String getPrefix() {
        String base = basePath == null ? "" : basePath.trim();
        String ver = version == null ? "" : version.trim();

        if (!base.isEmpty() && !base.startsWith("/")) {
            base = "/" + base;
        }
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        while (ver.startsWith("/")) {
            ver = ver.substring(1);
        }
        while (ver.endsWith("/")) {
            ver = ver.substring(0, ver.length() - 1);
        }

        return ver.isEmpty() ? base : base + "/" + ver;
    }
}
