export const ROLES = {
  ADMIN: 'ADMIN',
  USER: 'USER',
};

export const isAdmin = (role) => role === ROLES.ADMIN;

export const isUser = (role) => role === ROLES.USER;

export const canWrite = (role) => isAdmin(role);
