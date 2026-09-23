package com.company.inventory.service;

import org.springframework.web.multipart.MultipartFile;

import com.company.inventory.dto.response.ExtractInvoiceResponse;

/**
 * Bridges a desktop session and a phone for "scan a QR, capture the invoice on
 * your phone" flow.
 *
 * Flow:
 *   1. Desktop creates a session (QR encodes a URL with the session id).
 *   2. Phone opens that URL, captures/uploads an invoice image to the session.
 *   3. The image is run through the normal invoice extraction.
 *   4. Desktop polls the session and, once ready, opens the usual review dialog.
 *
 * Sessions live in memory only (transient handoff data) and expire quickly.
 */
public interface MobileCaptureService {

    /** Creates a capture session owned by the given user; returns its id. */
    String createSession(String username);

    /** Current status: WAITING | PROCESSING | READY | ERROR | EXPIRED | NOT_FOUND. */
    String status(String sessionId);

    /** Accepts a phone-captured image, runs extraction, stores the result. Returns the new status. */
    String submitImage(String sessionId, MultipartFile file);

    /** The extracted invoice once status is READY, else null. */
    ExtractInvoiceResponse result(String sessionId);
}
