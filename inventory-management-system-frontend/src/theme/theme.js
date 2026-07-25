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

  typography: {
    fontFamily: '"Inter", "Manrope", "Poppins", "Roboto", "Helvetica", "Arial", sans-serif',
    // 16px root; sizes below are rem-relative for consistent, comfortable reading.
    // Dashboard title (~34px)
    h1: { fontWeight: 700, fontSize: '2.125rem', lineHeight: 1.2, letterSpacing: '-0.02em' },
    // Page title (~30px)
    h2: { fontWeight: 700, fontSize: '1.875rem', lineHeight: 1.25, letterSpacing: '-0.02em' },
    // Section title (~24px)
    h3: { fontWeight: 600, fontSize: '1.5rem', lineHeight: 1.3, letterSpacing: '-0.01em' },
    h4: { fontWeight: 600, fontSize: '1.375rem', lineHeight: 1.35 },
    h5: { fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.4 },
    // Card title (~17px)
    h6: { fontWeight: 600, fontSize: '1.0625rem', lineHeight: 1.5 },
    subtitle1: { fontSize: '1rem', fontWeight: 500 },
    subtitle2: { fontSize: '0.9375rem', fontWeight: 600, color: colors.textSecondary },
    // Body text (16px / 15px)
    body1: { fontSize: '1rem', lineHeight: 1.65 },
    body2: { fontSize: '0.9375rem', lineHeight: 1.6 },
    button: { textTransform: 'none', fontWeight: 600, fontSize: '0.9375rem' },
    caption: { fontSize: '0.8125rem', color: colors.textMuted },
    overline: { fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' },
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
          fontWeight: 600,
          fontSize: '0.9375rem',
          borderRadius: radii.button,
          padding: '11px 22px',
          boxShadow: 'none',
          transition: 'background-color .18s ease, box-shadow .18s ease, transform .15s ease',
          '&:active': { transform: 'translateY(0)' },
        },
        containedPrimary: {
          '&:hover': { backgroundColor: colors.primaryHover, boxShadow: '0 6px 16px rgba(34,73,127,0.22)', transform: 'translateY(-1px)' },
        },
        outlined: { borderColor: colors.border, '&:hover': { backgroundColor: colors.hover, borderColor: '#D1D5DB', transform: 'translateY(-1px)' } },
        sizeLarge: { padding: '13px 26px', fontSize: '1rem' },
        sizeSmall: { padding: '8px 15px', fontSize: '0.875rem' },
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
      styleOverrides: { root: { padding: 24, '&:last-child': { paddingBottom: 24 } } },
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
        input: { padding: '14px 16px', fontSize: '1rem' },
        inputSizeSmall: { padding: '13px 14px', fontSize: '0.9375rem' },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { fontSize: '0.9375rem', color: colors.textSecondary } },
    },
    MuiFormHelperText: { styleOverrides: { root: { marginLeft: 2, fontSize: '0.8125rem' } } },

    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, fontSize: '0.75rem', borderRadius: radii.pill, height: 24 },
        label: { paddingLeft: 10, paddingRight: 10 },
      },
    },

    MuiTableContainer: {
      styleOverrides: { root: { borderRadius: radii.table } },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: colors.border, padding: '20px 20px', fontSize: '1.0625rem' },
        head: {
          fontWeight: 600,
          fontSize: '0.9375rem',
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          backgroundColor: '#F5F4F1',
          color: colors.textSecondary,
        },
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
      styleOverrides: { root: { fontSize: '1.25rem', fontWeight: 600, padding: '22px 24px' } },
    },
    MuiDialogContent: { styleOverrides: { root: { padding: '4px 24px 8px' } } },
    MuiDialogActions: { styleOverrides: { root: { padding: '16px 24px 20px', gap: 8 } } },

    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: '#1F2937', fontSize: '0.75rem', borderRadius: 8, padding: '6px 10px' },
      },
    },

    MuiMenu: {
      styleOverrides: {
        paper: { borderRadius: 12, border: `1px solid ${colors.border}`, boxShadow: shadows.cardHover, marginTop: 6 },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { fontSize: '0.9375rem', borderRadius: 8, margin: '2px 6px', padding: '10px 12px' },
      },
    },

    MuiListItemButton: {
      styleOverrides: { root: { borderRadius: radii.button } },
    },

    MuiAlert: {
      styleOverrides: { root: { borderRadius: 12, fontSize: '0.9375rem', alignItems: 'center' } },
    },

    MuiAppBar: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },

    MuiLinearProgress: {
      styleOverrides: { root: { borderRadius: 999, height: 8, backgroundColor: colors.hover } },
    },
  },
});

export default theme;
