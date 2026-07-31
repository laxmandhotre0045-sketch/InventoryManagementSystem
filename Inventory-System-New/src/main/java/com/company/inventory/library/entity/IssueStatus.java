package com.company.inventory.library.entity;

/**
 * Status of a single book-issue record. OVERDUE is derived at read time
 * (an ISSUED record whose due date has passed) rather than persisted, so it
 * is never stale; it is stored only when a return is recorded after the due date.
 */
public enum IssueStatus {
    ISSUED,
    RETURNED,
    OVERDUE
}
