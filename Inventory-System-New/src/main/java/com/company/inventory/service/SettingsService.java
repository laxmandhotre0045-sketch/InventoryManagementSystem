package com.company.inventory.service;

import java.util.List;
import java.util.Map;

import com.company.inventory.dto.response.SettingResponse;

public interface SettingsService {

    /** All settings grouped by category (insertion-ordered categories). */
    Map<String, List<SettingResponse>> getGrouped();

    List<SettingResponse> getByCategory(String category);

    /** Update existing settings from a key→value map; returns the new grouped view. */
    Map<String, List<SettingResponse>> update(Map<String, String> values, String username);

    /** Convenience accessor for other services (e.g. read a preference). */
    String getValue(String key, String defaultValue);
}
