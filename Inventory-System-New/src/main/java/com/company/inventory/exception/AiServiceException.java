package com.company.inventory.exception;

/**
 * The AI service (OpenAI) could not be used for a reason the user cannot fix by retrying
 * with a better photo — a rejected API key, an exhausted quota, or no connection. Carries
 * a plain, actionable message that is shown to the user as-is (HTTP 503).
 */
public class AiServiceException extends RuntimeException {

    public AiServiceException(String message) {
        super(message);
    }
}
