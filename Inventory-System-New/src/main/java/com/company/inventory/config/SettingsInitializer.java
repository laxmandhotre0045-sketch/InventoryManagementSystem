package com.company.inventory.config;

import java.util.List;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import com.company.inventory.entity.AppSetting;
import com.company.inventory.repository.AppSettingRepository;

/**
 * Seeds default application settings once, so the Settings module is populated
 * out of the box. Idempotent: only inserts keys that don't already exist, so
 * user edits are never overwritten on restart.
 */
@Component
@Order(30)
public class SettingsInitializer implements CommandLineRunner {

    private final AppSettingRepository settingRepository;

    public SettingsInitializer(AppSettingRepository settingRepository) {
        this.settingRepository = settingRepository;
    }

    private record Seed(String key, String value, String category, String type, String label) {}

    private static final List<Seed> DEFAULTS = List.of(
            // Company Information
            new Seed("company.name", "SensoVibe Reliability Pvt. Ltd.", "COMPANY", "string", "Company Name"),
            new Seed("company.email", "info@sensovibe.com", "COMPANY", "string", "Contact Email"),
            new Seed("company.phone", "+91 00000 00000", "COMPANY", "string", "Contact Phone"),
            new Seed("company.address", "", "COMPANY", "string", "Address"),
            new Seed("company.taxNumber", "", "COMPANY", "string", "GST / Tax Number"),
            new Seed("company.website", "https://sensovibe.com", "COMPANY", "string", "Website"),

            // System Preferences
            new Seed("preferences.dateFormat", "DD MMM YYYY", "PREFERENCES", "string", "Date Format"),
            new Seed("preferences.timezone", "Asia/Kolkata", "PREFERENCES", "string", "Timezone"),
            new Seed("preferences.itemsPerPage", "10", "PREFERENCES", "number", "Rows Per Page"),
            new Seed("preferences.language", "English", "PREFERENCES", "string", "Language"),

            // Inventory Configuration
            new Seed("inventory.currency", "INR", "INVENTORY", "string", "Currency"),
            new Seed("inventory.currencySymbol", "₹", "INVENTORY", "string", "Currency Symbol"),
            new Seed("inventory.defaultLowStockThreshold", "10", "INVENTORY", "number", "Default Low-Stock Threshold"),
            new Seed("inventory.autoGenerateItemCodes", "true", "INVENTORY", "boolean", "Auto-Generate Item Codes"),
            new Seed("inventory.allowNegativeStock", "false", "INVENTORY", "boolean", "Allow Negative Stock"),

            // Notification Settings
            new Seed("notifications.lowStockAlerts", "true", "NOTIFICATIONS", "boolean", "Low-Stock Alerts"),
            new Seed("notifications.outOfStockAlerts", "true", "NOTIFICATIONS", "boolean", "Out-of-Stock Alerts"),
            new Seed("notifications.newItemAlerts", "true", "NOTIFICATIONS", "boolean", "New Item Alerts"),
            new Seed("notifications.purchaseAlerts", "true", "NOTIFICATIONS", "boolean", "Purchase Alerts"),
            new Seed("notifications.emailNotifications", "false", "NOTIFICATIONS", "boolean", "Email Notifications"),

            // Backup & Restore (future-ready)
            new Seed("backup.autoBackup", "false", "BACKUP", "boolean", "Automatic Backup"),
            new Seed("backup.frequency", "weekly", "BACKUP", "string", "Backup Frequency"),
            new Seed("backup.retentionDays", "30", "BACKUP", "number", "Retention (days)")
    );

    /**
     * Settings that no longer exist. The Appearance group configured a theme and density
     * the interface never read, so it is removed rather than left as dead rows the API
     * would keep returning to clients.
     */
    private static final List<String> REMOVED_KEYS = List.of(
            "appearance.theme", "appearance.accentColor", "appearance.density");

    @Override
    public void run(String... args) {
        REMOVED_KEYS.forEach(key -> settingRepository.findBySettingKey(key)
                .ifPresent(settingRepository::delete));

        for (Seed seed : DEFAULTS) {
            if (!settingRepository.existsBySettingKey(seed.key())) {
                settingRepository.save(AppSetting.builder()
                        .settingKey(seed.key())
                        .settingValue(seed.value())
                        .category(seed.category())
                        .valueType(seed.type())
                        .label(seed.label())
                        .build());
            }
        }
    }
}
