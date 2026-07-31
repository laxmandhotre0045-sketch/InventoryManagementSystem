package com.company.inventory.dto.response;

import java.time.LocalDateTime;

import com.company.inventory.entity.NotificationSeverity;
import com.company.inventory.entity.NotificationType;

import lombok.Builder;
import lombok.Data;

/** Read model for a notification. */
@Data
@Builder
public class NotificationResponse {

    private Long id;
    private NotificationType type;
    private NotificationSeverity severity;
    private String title;
    private String message;
    private String referenceType;
    private Long referenceId;
    private boolean read;
    private LocalDateTime createdAt;
}
