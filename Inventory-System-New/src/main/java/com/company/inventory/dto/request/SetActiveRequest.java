package com.company.inventory.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

/** Payload to activate or deactivate an account. */
@Data
public class SetActiveRequest {

    @NotNull(message = "active is required")
    private Boolean active;
}
