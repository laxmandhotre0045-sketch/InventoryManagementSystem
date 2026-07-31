package com.company.inventory.library.dto.request;

import java.time.LocalDate;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** Payload to record the return of an issued book. */
@Data
public class ReturnBookRequest {

    @NotNull(message = "Issue record is required")
    private Long issueId;

    private LocalDate returnDate;

    @Size(max = 500, message = "Remarks must be at most 500 characters")
    private String remarks;
}
