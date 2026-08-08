package com.company.inventory.entity;

/**
 * Component lifecycle state.
 *
 * <p>Only two values are user-selectable — {@link #ACTIVE} ("Available") and
 * {@link #INACTIVE} ("Not Available"). {@link #ARCHIVED} is internal: it backs the
 * soft delete, so a component with stock movements or project history can be retired
 * without destroying those records, and it is never offered in the status picker.</p>
 *
 * <p>An earlier DISCONTINUED value duplicated INACTIVE with no behavioural difference;
 * existing rows are migrated to INACTIVE on startup.</p>
 */
public enum ComponentStatus {
    ACTIVE,
    INACTIVE,
    ARCHIVED
}
