// Central design tokens — Scandinavian-minimal light theme for SensoVibe.
// Calm, warm, spacious. Brand navy is used only for primary actions and
// selected states; orange is a rare accent (notifications / alerts).

export const colors = {
  // Surfaces — warm off-white canvas, white cards, WHITE sidebar
  canvas: '#F7F6F3', // warm off-white page background
  paper: '#FFFFFF',
  sidebar: '#FFFFFF',
  sidebarHover: '#F5F4F1', // warm neutral hover
  sidebarActive: '#EEF3FA', // faint brand-blue tint for selected nav
  border: '#EAE8E3', // thin warm border
  borderStrong: '#DEDCD6',
  hover: '#F5F4F1',

  // Brand — deep navy-blue from the SensoVibe logo, used sparingly
  primary: '#22497F',
  primaryHover: '#1A3A66',
  primaryDark: '#16305C',
  primarySoft: '#EEF3FA',

  // Orange accent — used only for notifications / small highlights
  accent: '#E08A22',
  accentSoft: '#FBF1E2',

  // Semantic — muted, calm variants (avoid loud colors)
  success: '#3C8C6A',
  successSoft: '#EDF5F0',
  warning: '#C08536',
  warningSoft: '#FAF3E8',
  danger: '#C1524A',
  dangerSoft: '#FBEDEB',
  info: '#22497F',
  infoSoft: '#EEF3FA',

  // Text — warm ink
  textPrimary: '#1E2329',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textInverse: '#FFFFFF',
};

// Soft pastel tints for KPI cards — very light, elegant, never saturated.
export const tints = {
  blue: { bg: '#F4F7FC', border: '#E4ECF6', fg: '#2C5C9E', chip: '#E7EFFA' },
  green: { bg: '#F2F8F4', border: '#E0EDE4', fg: '#3C8C6A', chip: '#E3F1E8' },
  orange: { bg: '#FCF7EF', border: '#F3E9D8', fg: '#B47B2E', chip: '#F6EAD6' },
  purple: { bg: '#F6F3FB', border: '#EAE4F4', fg: '#6B5CA5', chip: '#ECE6F6' },
  red: { bg: '#FCF2F0', border: '#F4E1DD', fg: '#BC4F47', chip: '#F7E2DE' },
};

export const radii = {
  card: 18,
  button: 10,
  input: 10,
  table: 16,
  modal: 20,
  pill: 999,
};

// Very subtle, soft shadows — barely-there at rest, gentle lift on hover.
export const shadows = {
  xs: '0 1px 2px rgba(16,24,40,0.04)',
  sm: '0 1px 2px rgba(16,24,40,0.05)',
  card: '0 1px 2px rgba(16,24,40,0.03)',
  cardHover: '0 8px 24px rgba(16,24,40,0.06)',
  lg: '0 16px 40px rgba(16,24,40,0.10)',
  navbar: '0 1px 0 rgba(16,24,40,0.04)',
};

export const layout = {
  sidebarWidth: 288,
  sidebarCollapsedWidth: 88,
  navbarHeight: 72,
  gap: 24,
};

// Status badges — calm, desaturated tones on soft neutral backgrounds.
export const statusPalette = {
  available: { label: 'Available', fg: colors.success, bg: colors.successSoft },
  in_stock: { label: 'In Stock', fg: colors.success, bg: colors.successSoft },
  low_stock: { label: 'Low Stock', fg: colors.warning, bg: colors.warningSoft },
  out_of_stock: { label: 'Out of Stock', fg: colors.danger, bg: colors.dangerSoft },
  pending: { label: 'Pending', fg: colors.warning, bg: colors.warningSoft },
  in_progress: { label: 'In Progress', fg: colors.info, bg: colors.infoSoft },
  maintenance: { label: 'Maintenance', fg: colors.warning, bg: colors.warningSoft },
  active: { label: 'Active', fg: colors.info, bg: colors.infoSoft },
  completed: { label: 'Completed', fg: colors.success, bg: colors.successSoft },
  cancelled: { label: 'Cancelled', fg: colors.textSecondary, bg: '#F2F1EE' },
  stock_in: { label: 'Stock In', fg: colors.success, bg: colors.successSoft },
  stock_out: { label: 'Stock Out', fg: colors.warning, bg: colors.warningSoft },
  default: { label: '', fg: colors.textSecondary, bg: '#F2F1EE' },
};
