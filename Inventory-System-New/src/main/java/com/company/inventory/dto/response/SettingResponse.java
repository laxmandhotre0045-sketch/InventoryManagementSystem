package com.company.inventory.dto.response;

import java.time.LocalDateTime;

import lombok.Builder;
import lombok.Data;

/** Read model for a single application setting. */
@Data
@Builder
public class SettingResponse {

    private String key;
    private String value;
    private String category;
    private String valueType;
    private String label;
    private LocalDateTime updatedAt;
}
