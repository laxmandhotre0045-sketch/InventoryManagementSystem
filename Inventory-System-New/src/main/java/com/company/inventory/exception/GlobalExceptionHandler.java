package com.company.inventory.exception;

import com.company.inventory.dto.response.ApiResponse;
import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AccountStatusException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import lombok.extern.slf4j.Slf4j;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Object>> handleNotFound(ResourceNotFoundException ex) {
        return new ResponseEntity<>(ApiResponse.failure(ex.getMessage(), null), HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(InsufficientStockException.class)
    public ResponseEntity<ApiResponse<Object>> handleInsufficientStock(InsufficientStockException ex) {
        return new ResponseEntity<>(ApiResponse.failure(ex.getMessage(), null), HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(ResourceInUseException.class)
    public ResponseEntity<ApiResponse<Object>> handleResourceInUse(ResourceInUseException ex) {
        return new ResponseEntity<>(ApiResponse.failure(ex.getMessage(), null), HttpStatus.CONFLICT);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Object>> handleIllegalArgument(IllegalArgumentException ex) {
        return new ResponseEntity<>(ApiResponse.failure(ex.getMessage(), null), HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleValidationErrors(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(error ->
                errors.put(error.getField(), error.getDefaultMessage())
        );
        return new ResponseEntity<>(ApiResponse.failure("Validation failed", errors), HttpStatus.BAD_REQUEST);
    }

    /**
     * A body Jackson cannot read: malformed JSON, a wrong field type, or a value outside
     * an enum (for example the retired DISCONTINUED component status). All of these are
     * client mistakes, so they get 400 rather than falling through to the 500 catch-all.
     * The parser's own message names internal classes, so it is logged, not returned.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Object>> handleUnreadableBody(HttpMessageNotReadableException ex) {
        log.warn("Rejected unreadable request body: {}", ex.getMostSpecificCause().getMessage());

        String message = "The request body could not be read. Check that every field has a valid value.";
        Throwable cause = ex.getCause();
        if (cause instanceof InvalidFormatException invalid && invalid.getTargetType() != null
                && invalid.getTargetType().isEnum()) {
            String allowed = java.util.Arrays.stream(invalid.getTargetType().getEnumConstants())
                    .map(String::valueOf)
                    .collect(java.util.stream.Collectors.joining(", "));
            message = "'" + invalid.getValue() + "' is not a valid value. Allowed values: " + allowed + ".";
        }
        return new ResponseEntity<>(ApiResponse.failure(message, null), HttpStatus.BAD_REQUEST);
    }

    /**
     * A path variable or query parameter that cannot be converted — {@code /purchases/abc}
     * when a numeric id is expected. That is a malformed request, not a server fault, so it
     * must not surface as a 500.
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Object>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return new ResponseEntity<>(ApiResponse.failure(
                "'" + ex.getName() + "' is not valid for this request.", null), HttpStatus.BAD_REQUEST);
    }

    /**
     * Unique-constraint and foreign-key violations (duplicate ISBN, duplicate employee id,
     * deleting a row another table still references). The driver's message names tables and
     * constraints, so it is logged rather than returned.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Object>> handleDataIntegrity(DataIntegrityViolationException ex) {
        log.warn("Data integrity violation", ex);
        return new ResponseEntity<>(ApiResponse.failure(
                "That change conflicts with existing data. A record with the same unique value may already exist, "
                + "or the item is still referenced elsewhere.", null), HttpStatus.CONFLICT);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiResponse<Object>> handleUploadTooLarge(MaxUploadSizeExceededException ex) {
        return new ResponseEntity<>(ApiResponse.failure(
                "The uploaded file is too large.", null), HttpStatus.PAYLOAD_TOO_LARGE);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiResponse<Object>> handleBadCredentials(BadCredentialsException ex) {
        return new ResponseEntity<>(ApiResponse.failure("Invalid email or password", null), HttpStatus.UNAUTHORIZED);
    }

    /**
     * A deactivated (or locked) account failing to sign in. Without this the
     * AccountStatusException falls through to the catch-all and the person is told
     * "something went wrong" instead of why they cannot get in.
     */
    @ExceptionHandler(AccountStatusException.class)
    public ResponseEntity<ApiResponse<Object>> handleAccountStatus(AccountStatusException ex) {
        String message = ex instanceof DisabledException
                ? "This account has been deactivated. Contact your administrator."
                : "This account is not currently able to sign in. Contact your administrator.";
        return new ResponseEntity<>(ApiResponse.failure(message, null), HttpStatus.UNAUTHORIZED);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Object>> handleAccessDenied(AccessDeniedException ex) {
        return new ResponseEntity<>(ApiResponse.failure("Access denied", null), HttpStatus.FORBIDDEN);
    }

    /**
     * Anything unhandled. The raw exception message can carry SQL fragments, file paths and
     * class names, so it is logged server-side and the client gets a generic message.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Object>> handleGeneralException(Exception ex) {
        log.error("Unhandled exception", ex);
        return new ResponseEntity<>(ApiResponse.failure(
                "Something went wrong. Please try again, or contact your administrator if it persists.", null),
                HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
