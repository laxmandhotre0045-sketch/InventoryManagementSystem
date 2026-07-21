// Central design tokens for the Inventory Management System.
// Single source of truth for colors, radii, shadows, and spacing.

export const colors = {
  // Surfaces
  canvas: '#F8FAFC', // main app background
  paper: '#FFFFFF', // cards / navbar
  sidebar: '#111827', // dark sidebar
  sidebarHover: '#1F2937',
  sidebarActive: '#2563EB',
  border: '#E5E7EB',
  hover: '#F3F4F6',

  // Brand
  primary: '#2563EB',
  primaryHover: '#1D4ED8',
  primaryDark: '#1E40AF',
  primarySoft: '#EFF6FF',

  // Semantic
  success: '#10B981',
  successSoft: '#ECFDF5',
  warning: '#F59E0B',
  warningSoft: '#FFFBEB',
  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
  info: '#3B82F6',
  infoSoft: '#EFF6FF',

  // Text
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textInverse: '#F9FAFB',
};

export const radii = {
  card: 16,
  button: 10,
  input: 10,
  table: 16,
  modal: 18,
  pill: 999,
};

export const shadows = {
  xs: '0 1px 2px rgba(15, 23, 42, 0.04)',
  sm: '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
  card: '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.03)',
  cardHover: '0 6px 24px rgba(15, 23, 42, 0.08)',
  lg: '0 12px 32px rgba(15, 23, 42, 0.10)',
  navbar: '0 1px 2px rgba(15, 23, 42, 0.04)',
};

export const layout = {
  sidebarWidth: 260,
  sidebarCollapsedWidth: 76,
  navbarHeight: 72,
  gap: 24,
};

// Semantic mapping for status badges used across tables.
export const statusPalette = {
  available: { label: 'Available', fg: colors.success, bg: colors.successSoft },
  in_stock: { label: 'In Stock', fg: colors.success, bg: colors.successSoft },
  low_stock: { label: 'Low Stock', fg: colors.warning, bg: colors.warningSoft },
  out_of_stock: { label: 'Out of Stock', fg: colors.danger, bg: colors.dangerSoft },
  pending: { label: 'Pending', fg: colors.warning, bg: colors.warningSoft },
  in_progress: { label: 'In Progress', fg: colors.info, bg: colors.infoSoft },
  active: { label: 'Active', fg: colors.info, bg: colors.infoSoft },
  completed: { label: 'Completed', fg: colors.success, bg: colors.successSoft },
  cancelled: { label: 'Cancelled', fg: colors.textSecondary, bg: colors.hover },
  stock_in: { label: 'Stock In', fg: colors.success, bg: colors.successSoft },
  stock_out: { label: 'Stock Out', fg: colors.warning, bg: colors.warningSoft },
  default: { label: '', fg: colors.textSecondary, bg: colors.hover },
};
