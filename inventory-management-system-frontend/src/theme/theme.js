import { createTheme } from '@mui/material/styles';
import { colors, radii, shadows } from './tokens';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: colors.primary, light: '#4A6DA3', dark: colors.primaryHover, contrastText: '#FFFFFF' },
    secondary: { main: colors.success, light: '#5AA588', dark: '#2E7357', contrastText: '#FFFFFF' },
    error: { main: colors.danger, light: '#D47A72', dark: '#A5423B' },
    warning: { main: colors.warning, light: '#D3A05B', dark: '#A06E2B' },
    info: { main: colors.info, light: '#4A6DA3', dark: colors.primaryHover },
    success: { main: colors.success, light: '#5AA588', dark: '#2E7357' },
    background: { default: colors.canvas, paper: colors.paper },
    text: { primary: colors.textPrimary, secondary: colors.textSecondary, disabled: colors.textMuted },
    divider: colors.border,
    grey: {
      50: '#F9FAFB', 100: '#F3F4F6', 200: '#E5E7EB', 300: '#D1D5DB',
      400: '#9CA3AF', 500: '#6B7280', 600: '#4B5563', 700: '#374151',
      800: '#1F2937', 900: '#111827',
    },
  },

  /**
   * Type scale calibrated against enterprise dashboards (SAP Fiori, Microsoft
   * Admin Center, Atlassian, Linear, Notion), all of which set body text at
   * 14px rather than 16px and keep headings tight above it.
   *
   * The root stays at 16px so rem maths is predictable; 0.875rem = 14px is the
   * workhorse size. Each step was chosen for its role, not by scaling the old
   * values by a fixed ratio — headings tightened most, small text least, so the
   * hierarchy stays legible instead of collapsing.
   */
  typography: {
    fontFamily: '"Inter", "Manrope", "Poppins", "Roboto", "Helvetica", "Arial", sans-serif',
    // Dashboard greeting / hero (28px)
    h1: { fontWeight: 700, fontSize: '1.75rem', lineHeight: 1.25, letterSpacing: '-0.021em' },
    // Page title (22px)
    h2: { fontWeight: 650, fontSize: '1.375rem', lineHeight: 1.3, letterSpacing: '-0.018em' },
    // Section title (18px)
    h3: { fontWeight: 600, fontSize: '1.125rem', lineHeight: 1.35, letterSpacing: '-0.012em' },
    // Panel / chart-card title (16px)
    h4: { fontWeight: 600, fontSize: '1rem', lineHeight: 1.4, letterSpacing: '-0.008em' },
    // Dialog title (15px)
    h5: { fontWeight: 600, fontSize: '0.9375rem', lineHeight: 1.45 },
    // Card title (14px)
    h6: { fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.45 },
    subtitle1: { fontSize: '0.875rem', fontWeight: 550, lineHeight: 1.5 },
    subtitle2: { fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.5, color: colors.textSecondary },
    // Body (14px / 13px)
    body1: { fontSize: '0.875rem', lineHeight: 1.55 },
    body2: { fontSize: '0.8125rem', lineHeight: 1.5 },
    button: { textTransform: 'none', fontWeight: 550, fontSize: '0.875rem', letterSpacing: 0 },
    caption: { fontSize: '0.75rem', lineHeight: 1.45, color: colors.textMuted },
    overline: { fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' },
  },

  shape: { borderRadius: radii.button },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          // Prevents mobile/embedded browsers (iOS Safari, some Android WebViews)
          // from auto-inflating font sizes — the usual cause of "fonts look much
          // bigger in the deployed build than in dev".
          WebkitTextSizeAdjust: '100%',
          textSizeAdjust: '100%',
          // rem base stays a predictable 16px regardless of the platform.
          fontSize: '16px',
        },
        body: {
          backgroundColor: colors.canvas,
          color: colors.textPrimary,
          scrollBehavior: 'smooth',
          overflowX: 'hidden',
        },
        '*::-webkit-scrollbar': { width: 10, height: 10 },
        '*::-webkit-scrollbar-track': { background: 'transparent' },
        '*::-webkit-scrollbar-thumb': {
          background: '#D1D5DB', borderRadius: 8, border: '2px solid transparent', backgroundClip: 'content-box',
        },
        '*::-webkit-scrollbar-thumb:hover': { background: '#9CA3AF', backgroundClip: 'content-box' },
      },
    },

    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 550,
          fontSize: '0.875rem',
          lineHeight: 1.5,
          borderRadius: radii.button,
          padding: '7px 16px',
          minHeight: 36,
          boxShadow: 'none',
          transition: 'background-color .18s ease, box-shadow .18s ease, transform .15s ease',
          '&:active': { transform: 'translateY(0)' },
        },
        containedPrimary: {
          '&:hover': { backgroundColor: colors.primaryHover, boxShadow: '0 4px 12px rgba(34,73,127,0.20)', transform: 'translateY(-1px)' },
        },
        outlined: { borderColor: colors.border, '&:hover': { backgroundColor: colors.hover, borderColor: '#D1D5DB', transform: 'translateY(-1px)' } },
        sizeLarge: { padding: '9px 20px', fontSize: '0.9375rem', minHeight: 42 },
        sizeSmall: { padding: '4px 10px', fontSize: '0.8125rem', minHeight: 30 },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: radii.button, transition: 'background-color .18s ease' },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: radii.card,
          border: `1px solid ${colors.border}`,
          boxShadow: shadows.card,
          backgroundImage: 'none',
        },
      },
    },
    MuiCardContent: {
      styleOverrides: { root: { padding: 20, '&:last-child': { paddingBottom: 20 } } },
    },

    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        outlined: { borderColor: colors.border },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: radii.input,
          backgroundColor: colors.paper,
          transition: 'box-shadow .18s ease, border-color .18s ease',
          '& fieldset': { borderColor: colors.border },
          '&:hover fieldset': { borderColor: '#D1D5DB' },
          '&.Mui-focused fieldset': { borderColor: colors.primary, borderWidth: 1 },
          '&.Mui-focused': { boxShadow: `0 0 0 3px ${colors.primarySoft}` },
        },
        input: { padding: '9px 12px', fontSize: '0.875rem', height: '1.4375em' },
        inputSizeSmall: { padding: '7px 10px', fontSize: '0.8125rem' },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { fontSize: '0.875rem', color: colors.textSecondary },
        sizeSmall: { fontSize: '0.8125rem' },
      },
    },
    MuiFormHelperText: { styleOverrides: { root: { marginLeft: 2, fontSize: '0.75rem' } } },
    MuiFormControlLabel: {
      styleOverrides: { label: { fontSize: '0.875rem' } },
    },

    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, fontSize: '0.6875rem', borderRadius: radii.pill, height: 22 },
        label: { paddingLeft: 8, paddingRight: 8 },
        sizeSmall: { height: 20, fontSize: '0.6875rem' },
      },
    },

    MuiTableContainer: {
      styleOverrides: { root: { borderRadius: radii.table } },
    },
    MuiTableCell: {
      styleOverrides: {
        // 13px cells on a 40px row — dense enough to show a useful number of
        // records without the cramped feel of a 12px grid.
        root: { borderColor: colors.border, padding: '10px 16px', fontSize: '0.8125rem', lineHeight: 1.45 },
        head: {
          fontWeight: 600,
          fontSize: '0.6875rem',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          backgroundColor: '#F5F4F1',
          color: colors.textSecondary,
          padding: '9px 16px',
          whiteSpace: 'nowrap',
        },
        sizeSmall: { padding: '7px 12px' },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color .15s ease',
          '&:last-child td': { borderBottom: 0 },
          '&:hover': { backgroundColor: '#FAF9F7' },
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: radii.modal, boxShadow: shadows.lg, border: `1px solid ${colors.border}` },
      },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.011em', padding: '18px 20px 14px' } },
    },
    MuiDialogContent: { styleOverrides: { root: { padding: '4px 20px 8px' } } },
    MuiDialogActions: { styleOverrides: { root: { padding: '14px 20px 18px', gap: 8 } } },

    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: '#1F2937', fontSize: '0.6875rem', borderRadius: 6, padding: '5px 9px' },
      },
    },

    MuiMenu: {
      styleOverrides: {
        paper: { borderRadius: 10, border: `1px solid ${colors.border}`, boxShadow: shadows.cardHover, marginTop: 6 },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { fontSize: '0.875rem', borderRadius: 6, margin: '2px 6px', padding: '7px 10px', minHeight: 34 },
      },
    },
    MuiListItemIcon: {
      styleOverrides: { root: { minWidth: 32 } },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontSize: '0.875rem', fontWeight: 550, minHeight: 44, padding: '10px 14px' },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        root: { fontSize: '0.8125rem' },
        selectLabel: { fontSize: '0.8125rem' },
        displayedRows: { fontSize: '0.8125rem' },
      },
    },
    MuiBreadcrumbs: {
      styleOverrides: { root: { fontSize: '0.75rem' } },
    },

    MuiListItemButton: {
      styleOverrides: { root: { borderRadius: radii.button } },
    },

    MuiAlert: {
      styleOverrides: { root: { borderRadius: 8, fontSize: '0.8125rem', alignItems: 'center', padding: '5px 12px' } },
    },

    MuiAppBar: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },

    MuiLinearProgress: {
      styleOverrides: { root: { borderRadius: 999, height: 6, backgroundColor: colors.hover } },
    },
  },
});

export default theme;
