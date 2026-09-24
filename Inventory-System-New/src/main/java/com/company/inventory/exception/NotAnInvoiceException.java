package com.company.inventory.exception;

/**
 * Thrown when the uploaded file is readable but is not a supplier invoice
 * (a photo of something else, a screenshot, notes, a blank page...).
 *
 * <p>This is deliberately distinct from a genuine extraction failure: nothing is
 * wrong with the service, the document simply isn't an invoice. Suggesting line
 * items for such a file is worse than refusing it, because the operator would be
 * asked to confirm stock that does not exist on any document.</p>
 */
public class NotAnInvoiceException extends RuntimeException {

    public NotAnInvoiceException(String message) {
        super(message);
    }
}
