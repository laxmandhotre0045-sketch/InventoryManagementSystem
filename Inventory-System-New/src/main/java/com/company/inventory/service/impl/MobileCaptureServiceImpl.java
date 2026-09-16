package com.company.inventory.service.impl;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.company.inventory.dto.response.ExtractInvoiceResponse;
import com.company.inventory.service.InvoiceExtractionService;
import com.company.inventory.service.MobileCaptureService;

import lombok.extern.slf4j.Slf4j;

/**
 * In-memory implementation of the phone-capture handoff. Sessions are short-lived
 * (15 min) and hold only the extracted result until the desktop picks it up, so a
 * database table would be overkill; losing them on restart is fine.
 */
@Slf4j
@Service
public class MobileCaptureServiceImpl implements MobileCaptureService {

    private static final Duration TTL = Duration.ofMinutes(30);

    private final InvoiceExtractionService invoiceExtractionService;
    private final ConcurrentHashMap<String, Session> sessions = new ConcurrentHashMap<>();

    public MobileCaptureServiceImpl(InvoiceExtractionService invoiceExtractionService) {
        this.invoiceExtractionService = invoiceExtractionService;
    }

    private static final class Session {
        final String username;
        final Instant createdAt = Instant.now();
        volatile String status = "WAITING";
        volatile ExtractInvoiceResponse result;
        volatile String error;

        Session(String username) {
            this.username = username;
        }

        boolean isExpired() {
            return Instant.now().isAfter(createdAt.plus(TTL));
        }
    }

    @Override
    public String createSession(String username) {
        purgeExpired();
        String id = UUID.randomUUID().toString().replace("-", "");
        sessions.put(id, new Session(username));
        return id;
    }

    @Override
    public String status(String sessionId) {
        Session s = sessions.get(sessionId);
        if (s == null) {
            return "NOT_FOUND";
        }
        if (s.isExpired()) {
            sessions.remove(sessionId);
            return "EXPIRED";
        }
        return s.status;
    }

    @Override
    public String submitImage(String sessionId, MultipartFile file) {
        Session s = sessions.get(sessionId);
        if (s == null) {
            throw new IllegalArgumentException("This capture session was not found. Ask the desktop to show a new QR code.");
        }
        if (s.isExpired()) {
            sessions.remove(sessionId);
            throw new IllegalArgumentException("This capture session has expired. Ask the desktop to show a new QR code.");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("No image was received. Please capture the invoice again.");
        }
        s.status = "PROCESSING";
        try {
            ExtractInvoiceResponse extracted = invoiceExtractionService.extractInvoice(file, s.username);
            s.result = extracted;
            s.status = "READY";
            return s.status;
        } catch (Exception ex) {
            log.error("Mobile capture extraction failed for session {}: {}", sessionId, ex.getMessage());
            s.error = ex.getMessage();
            s.status = "ERROR";
            throw new IllegalStateException("Could not read the invoice image. Please try again with a clearer photo.");
        }
    }

    @Override
    public ExtractInvoiceResponse result(String sessionId) {
        Session s = sessions.get(sessionId);
        if (s == null || s.isExpired()) {
            return null;
        }
        return s.result;
    }

    private void purgeExpired() {
        sessions.entrySet().removeIf(e -> e.getValue().isExpired());
    }
}
