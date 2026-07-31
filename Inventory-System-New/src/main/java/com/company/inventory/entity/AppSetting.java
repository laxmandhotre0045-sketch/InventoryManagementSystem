package com.company.inventory.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A single configurable setting, stored as a key/value pair grouped by category
 * (COMPANY, PREFERENCES, INVENTORY, NOTIFICATIONS, APPEARANCE, BACKUP).
 * Values are stored as text; the frontend interprets them per key (string, number,
 * boolean). This keeps settings fully dynamic and DB-persisted — no hardcoding.
 */
@Entity
@Table(name = "app_settings", indexes = {
        @Index(name = "idx_app_settings_key", columnList = "setting_key", unique = true),
        @Index(name = "idx_app_settings_category", columnList = "category")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AppSetting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "setting_key", nullable = false, unique = true, length = 100)
    private String settingKey;

    @Column(name = "setting_value", length = 2000)
    private String settingValue;

    @Column(nullable = false, length = 40)
    private String category;

    @Column(length = 20)
    @Builder.Default
    private String valueType = "string"; // string | number | boolean

    @Column(length = 160)
    private String label;

    @Column(name = "updated_by", length = 120)
    private String updatedBy;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
