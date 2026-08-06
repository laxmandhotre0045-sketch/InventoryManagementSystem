package com.company.inventory.entity;

/**
 * Account roles, in descending order of privilege.
 *
 * <p>{@link #MASTER_ADMIN} is the single system owner. It is the only role that may
 * manage accounts (create, edit, activate/deactivate, delete, reset passwords and
 * change roles), and no other account may modify or delete it. At most one exists.</p>
 *
 * <p>{@link #ADMIN} keeps full access to the inventory and library modules but has no
 * account-management rights, so an admin can neither create peers nor promote itself.</p>
 */
public enum Role {
    MASTER_ADMIN,
    ADMIN,
    USER
}
