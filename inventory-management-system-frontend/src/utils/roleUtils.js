export const ROLES = {
  MASTER_ADMIN: 'MASTER_ADMIN',
  ADMIN: 'ADMIN',
  USER: 'USER',
};

/** The single system owner — the only role allowed to manage accounts. */
export const isMasterAdmin = (role) => role === ROLES.MASTER_ADMIN;

/**
 * Admin-level access to the application itself.
 *
 * The master admin is an admin too, so every existing admin-gated screen and
 * action stays available to the owner. This mirrors the backend, where
 * MASTER_ADMIN also carries ROLE_ADMIN.
 */
export const isAdmin = (role) => role === ROLES.ADMIN || role === ROLES.MASTER_ADMIN;

export const isUser = (role) => role === ROLES.USER;

export const canWrite = (role) => isAdmin(role);

/** Only the master admin may create, edit, suspend, delete or re-role accounts. */
export const canManageUsers = (role) => isMasterAdmin(role);

/** Human-readable role label used across the UI. */
export const roleLabel = (role) => {
  switch (role) {
    case ROLES.MASTER_ADMIN: return 'Master Admin';
    case ROLES.ADMIN: return 'Administrator';
    case ROLES.USER: return 'Member';
    default: return 'Member';
  }
};
