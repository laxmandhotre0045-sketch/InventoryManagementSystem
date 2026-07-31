package com.company.inventory.library.entity;

/**
 * Lifecycle status of a book title in the library catalogue.
 * Availability (copies in hand) is tracked separately via availableCopies.
 */
public enum BookStatus {
    ACTIVE,
    INACTIVE,
    ARCHIVED
}
