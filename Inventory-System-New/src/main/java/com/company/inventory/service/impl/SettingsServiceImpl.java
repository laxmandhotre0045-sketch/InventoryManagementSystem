package com.company.inventory.service.impl;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.company.inventory.dto.response.SettingResponse;
import com.company.inventory.entity.AppSetting;
import com.company.inventory.repository.AppSettingRepository;
import com.company.inventory.service.SettingsService;

@Service
public class SettingsServiceImpl implements SettingsService {

    // Stable display order for categories in the UI.
    private static final List<String> CATEGORY_ORDER = List.of(
            "COMPANY", "PREFERENCES", "INVENTORY", "NOTIFICATIONS", "APPEARANCE", "BACKUP");

    private final AppSettingRepository settingRepository;

    public SettingsServiceImpl(AppSettingRepository settingRepository) {
        this.settingRepository = settingRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, List<SettingResponse>> getGrouped() {
        List<AppSetting> all = settingRepository.findAllByOrderByCategoryAscSettingKeyAsc();
        Map<String, List<SettingResponse>> grouped = new LinkedHashMap<>();
        CATEGORY_ORDER.forEach(c -> grouped.put(c, new java.util.ArrayList<>()));
        for (AppSetting s : all) {
            grouped.computeIfAbsent(s.getCategory(), k -> new java.util.ArrayList<>()).add(toResponse(s));
        }
        // Drop empty categories that were pre-seeded but hold nothing.
        grouped.values().removeIf(List::isEmpty);
        return grouped;
    }

    @Override
    @Transactional(readOnly = true)
    public List<SettingResponse> getByCategory(String category) {
        return settingRepository.findByCategory(category).stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public Map<String, List<SettingResponse>> update(Map<String, String> values, String username) {
        if (values != null) {
            values.forEach((key, value) ->
                    settingRepository.findBySettingKey(key).ifPresent(setting -> {
                        setting.setSettingValue(value);
                        setting.setUpdatedBy(username);
                        settingRepository.save(setting);
                    }));
        }
        return getGrouped();
    }

    @Override
    @Transactional(readOnly = true)
    public String getValue(String key, String defaultValue) {
        return settingRepository.findBySettingKey(key)
                .map(AppSetting::getSettingValue)
                .orElse(defaultValue);
    }

    private SettingResponse toResponse(AppSetting s) {
        return SettingResponse.builder()
                .key(s.getSettingKey())
                .value(s.getSettingValue())
                .category(s.getCategory())
                .valueType(s.getValueType())
                .label(s.getLabel())
                .updatedAt(s.getUpdatedAt())
                .build();
    }
}
