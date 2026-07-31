package com.company.inventory.dto.request;

import java.util.Map;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * Bulk settings update: a flat map of setting key → new value. Only keys that
 * already exist (seeded) are updated; unknown keys are ignored for safety.
 */
@Data
public class UpdateSettingsRequest {

    @NotNull(message = "settings map is required")
    private Map<String, String> settings;
}
