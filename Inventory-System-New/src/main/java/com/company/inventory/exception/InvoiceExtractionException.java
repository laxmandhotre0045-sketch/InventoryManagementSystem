package com.company.inventory.exception;

/**
 * Thrown when invoice extraction genuinely fails (AI timeout, unreadable image,
 * upstream API error). Carries a message intended for the operator, so it must
 * not be replaced with a generic one on the way out.
 */
public class InvoiceExtractionException extends RuntimeException {

    public InvoiceExtractionException(String message) {
        super(message);
    }

    public InvoiceExtractionException(String message, Throwable cause) {
        super(message, cause);
    }
}
