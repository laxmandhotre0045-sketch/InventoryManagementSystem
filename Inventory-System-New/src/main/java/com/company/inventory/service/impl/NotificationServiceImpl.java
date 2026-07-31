package com.company.inventory.service.impl;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.company.inventory.dto.response.NotificationResponse;
import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.entity.Notification;
import com.company.inventory.entity.NotificationSeverity;
import com.company.inventory.entity.NotificationType;
import com.company.inventory.exception.ResourceNotFoundException;
import com.company.inventory.repository.NotificationRepository;
import com.company.inventory.service.NotificationService;

@Service
public class NotificationServiceImpl implements NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationServiceImpl.class);

    private final NotificationRepository notificationRepository;

    public NotificationServiceImpl(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Override
    @Transactional
    public void notify(NotificationType type, NotificationSeverity severity, String title, String message,
                       String referenceType, Long referenceId) {
        try {
            Notification n = Notification.builder()
                    .type(type)
                    .severity(severity != null ? severity : NotificationSeverity.INFO)
                    .title(title)
                    .message(message)
                    .referenceType(referenceType)
                    .referenceId(referenceId)
                    .read(false)
                    .build();
            notificationRepository.save(n);
        } catch (Exception ex) {
            // Best-effort: never let a notification failure affect the caller.
            log.warn("Failed to create notification ({}): {}", type, ex.getMessage());
        }
    }

    @Override
    public void notifyComponentAdded(Long id, String itemCode, String name) {
        notify(NotificationType.COMPONENT_ADDED, NotificationSeverity.SUCCESS,
                "New component added",
                String.format("%s (%s) was added to the catalogue.", name, itemCode),
                "COMPONENT", id);
    }

    @Override
    public void notifyEquipmentAdded(Long id, String itemCode, String name) {
        notify(NotificationType.EQUIPMENT_ADDED, NotificationSeverity.SUCCESS,
                "New equipment added",
                String.format("%s (%s) was registered.", name, itemCode),
                "EQUIPMENT", id);
    }

    @Override
    public void notifyPurchaseCreated(Long id, String invoiceNumber, String supplierName) {
        notify(NotificationType.PURCHASE_CREATED, NotificationSeverity.INFO,
                "Purchase created",
                String.format("Invoice %s from %s was recorded.", invoiceNumber, supplierName),
                "PURCHASE", id);
    }

    @Override
    public void notifyInventoryUpdated(Long componentId, String itemCode, String name, String action,
                                       int quantityChanged, Integer newQuantity, Integer minimumQuantity) {
        notify(NotificationType.INVENTORY_UPDATED, NotificationSeverity.INFO,
                "Inventory updated",
                String.format("%s %s for %s (%s). On hand: %s.",
                        action, quantityChanged, name, itemCode,
                        newQuantity != null ? newQuantity : "?"),
                "COMPONENT", componentId);

        if (newQuantity == null) {
            return;
        }
        try {
            if (newQuantity == 0) {
                if (!notificationRepository.existsByTypeAndReferenceIdAndReadFalse(NotificationType.OUT_OF_STOCK, componentId)) {
                    notify(NotificationType.OUT_OF_STOCK, NotificationSeverity.CRITICAL,
                            "Out of stock",
                            String.format("%s (%s) is out of stock.", name, itemCode),
                            "COMPONENT", componentId);
                }
            } else if (minimumQuantity != null && newQuantity <= minimumQuantity) {
                if (!notificationRepository.existsByTypeAndReferenceIdAndReadFalse(NotificationType.LOW_STOCK, componentId)) {
                    notify(NotificationType.LOW_STOCK, NotificationSeverity.WARNING,
                            "Low stock",
                            String.format("%s (%s) is low: %d left (min %d).",
                                    name, itemCode, newQuantity, minimumQuantity),
                            "COMPONENT", componentId);
                }
            }
        } catch (Exception ex) {
            log.warn("Failed to evaluate stock-level alert for component {}: {}", componentId, ex.getMessage());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public PagedResponse<NotificationResponse> list(boolean unreadOnly, int page, int size) {
        int safeSize = size < 1 ? 10 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(Math.max(0, page), safeSize);
        Page<Notification> result = unreadOnly
                ? notificationRepository.findByReadFalseOrderByCreatedAtDesc(pageable)
                : notificationRepository.findAllByOrderByCreatedAtDesc(pageable);
        PagedResponse<NotificationResponse> response = new PagedResponse<>();
        response.setContent(result.getContent().stream().map(this::toResponse).toList());
        response.setPage(result.getNumber());
        response.setSize(result.getSize());
        response.setTotalElements(result.getTotalElements());
        response.setTotalPages(result.getTotalPages());
        response.setLast(result.isLast());
        return response;
    }

    @Override
    @Transactional(readOnly = true)
    public List<NotificationResponse> recent() {
        return notificationRepository.findTop8ByOrderByCreatedAtDesc().stream().map(this::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public long unreadCount() {
        return notificationRepository.countByReadFalse();
    }

    @Override
    @Transactional
    public NotificationResponse markRead(Long id) {
        Notification n = notificationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found with id " + id));
        n.setRead(true);
        return toResponse(notificationRepository.save(n));
    }

    @Override
    @Transactional
    public int markAllRead() {
        return notificationRepository.markAllRead();
    }

    private NotificationResponse toResponse(Notification n) {
        return NotificationResponse.builder()
                .id(n.getId())
                .type(n.getType())
                .severity(n.getSeverity())
                .title(n.getTitle())
                .message(n.getMessage())
                .referenceType(n.getReferenceType())
                .referenceId(n.getReferenceId())
                .read(n.isRead())
                .createdAt(n.getCreatedAt())
                .build();
    }
}
