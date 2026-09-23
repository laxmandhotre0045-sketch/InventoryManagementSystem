package com.company.inventory.controller;

import java.io.IOException;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.company.inventory.dto.response.ApiResponse;
import com.company.inventory.dto.response.ExtractInvoiceResponse;
import com.company.inventory.service.MobileCaptureService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * "Capture an invoice on your phone" bridge.
 *
 * Security note (see SecurityConfig): {@code /status} and {@code /upload} are
 * public because the phone that scans the QR is not logged in — the unguessable,
 * short-lived session id is the capability. Creating a session and reading the
 * result require an authenticated ADMIN (the desktop).
 */
@RestController
@RequestMapping("/mobile-capture")
@Tag(name = "Mobile Capture", description = "Scan a QR to capture an invoice on your phone")
public class MobileCaptureController {

    private final MobileCaptureService mobileCaptureService;

    public MobileCaptureController(MobileCaptureService mobileCaptureService) {
        this.mobileCaptureService = mobileCaptureService;
    }

    @Operation(summary = "Create a phone-capture session (desktop, authenticated)")
    @PostMapping("/session")
    public ResponseEntity<ApiResponse<Map<String, String>>> createSession(Authentication authentication) {
        String username = authentication != null ? authentication.getName() : "SYSTEM";
        String sessionId = mobileCaptureService.createSession(username);
        return ResponseEntity.ok(ApiResponse.success("Session created", Map.of("sessionId", sessionId)));
    }

    @Operation(summary = "Session status (public — polled by phone and desktop)")
    @GetMapping("/{sessionId}/status")
    public ResponseEntity<ApiResponse<Map<String, String>>> status(@PathVariable String sessionId) {
        return ResponseEntity.ok(ApiResponse.success("OK",
                Map.of("status", mobileCaptureService.status(sessionId))));
    }

    @Operation(summary = "Upload a phone-captured invoice image (public, session-scoped)")
    @PostMapping(value = "/{sessionId}/upload", consumes = "multipart/form-data")
    public ResponseEntity<ApiResponse<Map<String, String>>> upload(
            @PathVariable String sessionId,
            @RequestParam("file") MultipartFile file) throws IOException {
        String status = mobileCaptureService.submitImage(sessionId, file);
        return ResponseEntity.ok(ApiResponse.success("Invoice received", Map.of("status", status)));
    }

    @Operation(summary = "Fetch the extracted result (desktop, authenticated)")
    @GetMapping("/{sessionId}/result")
    public ResponseEntity<ApiResponse<ExtractInvoiceResponse>> result(@PathVariable String sessionId) {
        ExtractInvoiceResponse result = mobileCaptureService.result(sessionId);
        if (result == null) {
            return ResponseEntity.ok(ApiResponse.failure("Not ready", null));
        }
        return ResponseEntity.ok(ApiResponse.success("Ready", result));
    }
}
