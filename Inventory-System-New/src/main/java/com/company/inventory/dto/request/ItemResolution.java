package com.company.inventory.dto.request;

/**
 * How the user chose to resolve one invoice line during review.
 * Nothing is created automatically — the user picks one of these explicitly.
 */
public enum ItemResolution {
    /** Map to an existing component (componentId set). Adds stock. */
    EXISTING_COMPONENT,
    /** Create a new component from the line, then add stock. */
    NEW_COMPONENT,
    /** Map to an existing equipment asset (equipmentId set). Registered, no stock change. */
    EXISTING_EQUIPMENT,
    /** Register a new equipment asset from the line. No stock change. */
    NEW_EQUIPMENT,
    /** Ignore this line (e.g. shipping / service charges). */
    SKIP
}
