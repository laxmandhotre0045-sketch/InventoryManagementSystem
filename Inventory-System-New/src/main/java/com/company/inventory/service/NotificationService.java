package com.company.inventory.service;

import java.util.List;

import com.company.inventory.dto.response.NotificationResponse;
import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.entity.NotificationSeverity;
import com.company.inventory.entity.NotificationType;

/**
 * Creates and serves system notifications. All {@code notify*} methods are
 * best-effort: they never throw into the caller, so a notification failure can
 * never break the business operation that triggered it.
 */
public interface NotificationService {

    void notify(NotificationType type, NotificationSeverity severity, String title, String message,
                String referenceType, Long referenceId);

    void notifyComponentAdded(Long id, String itemCode, String name);

    void notifyEquipmentAdded(Long id, String itemCode, String name);

    void notifyPurchaseCreated(Long id, String invoiceNumber, String supplierName);

    /**
     * Records an inventory-updated notification and, based on the resulting
     * quantity, raises a low-stock or out-of-stock alert (de-duplicated while unread).
     */
    void notifyInventoryUpdated(Long componentId, String itemCode, String name, String action,
                                int quantityChanged, Integer newQuantity, Integer minimumQuantity);

    PagedResponse<NotificationResponse> list(boolean unreadOnly, int page, int size);

    List<NotificationResponse> recent();

    long unreadCount();

    NotificationResponse markRead(Long id);

    int markAllRead();
}
