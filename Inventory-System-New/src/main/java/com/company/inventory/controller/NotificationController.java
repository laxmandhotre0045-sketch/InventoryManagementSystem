package com.company.inventory.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.company.inventory.dto.response.ApiResponse;
import com.company.inventory.dto.response.NotificationResponse;
import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.service.NotificationService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/notifications")
@Tag(name = "Notifications", description = "Real-time system notifications and alerts")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @Operation(summary = "List notifications (optionally unread only)")
    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<NotificationResponse>>> list(
            @RequestParam(defaultValue = "false") boolean unreadOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success("Notifications retrieved successfully",
                notificationService.list(unreadOnly, page, size)));
    }

    @Operation(summary = "Recent notifications for the bell dropdown")
    @GetMapping("/recent")
    public ResponseEntity<ApiResponse<List<NotificationResponse>>> recent() {
        return ResponseEntity.ok(ApiResponse.success("Recent notifications retrieved successfully",
                notificationService.recent()));
    }

    @Operation(summary = "Unread notification count")
    @GetMapping("/unread-count")
    public ResponseEntity<ApiResponse<Long>> unreadCount() {
        return ResponseEntity.ok(ApiResponse.success("Unread count retrieved successfully",
                notificationService.unreadCount()));
    }

    @Operation(summary = "Mark one notification as read")
    @PutMapping("/{id}/read")
    public ResponseEntity<ApiResponse<NotificationResponse>> markRead(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Notification marked as read",
                notificationService.markRead(id)));
    }

    @Operation(summary = "Mark all notifications as read")
    @PutMapping("/read-all")
    public ResponseEntity<ApiResponse<Integer>> markAllRead() {
        return ResponseEntity.ok(ApiResponse.success("All notifications marked as read",
                notificationService.markAllRead()));
    }
}
