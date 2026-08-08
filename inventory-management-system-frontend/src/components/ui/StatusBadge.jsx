import { Box } from '@mui/material';
import {
  Check, AlertTriangle, XCircle, Clock, Ban, Wrench, Activity, ArrowDownLeft, ArrowUpRight,
} from 'lucide-react';
import { statusPalette } from '../../theme/tokens';

// Contextual icons per status (subtle, 13px).
const iconMap = {
  active: Activity,
  available: Check,
  not_available: XCircle,
  in_stock: Check,
  completed: Check,
  low_stock: AlertTriangle,
  out_of_stock: XCircle,
  pending: Clock,
  in_progress: Clock,
  maintenance: Wrench,
  cancelled: Ban,
  stock_in: ArrowDownLeft,
  stock_out: ArrowUpRight,
};

const normalize = (status) =>
  String(status ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

const prettify = (status) =>
  String(status ?? '').replace(/[_-]+/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const StatusBadge = ({ status, label }) => {
  const key = normalize(status);
  const cfg = statusPalette[key] || statusPalette.default;
  const text = label || cfg.label || prettify(status) || '—';
  const Icon = iconMap[key];

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: '3px',
        borderRadius: 999,
        fontSize: '0.6875rem',
        fontWeight: 600,
        lineHeight: 1.35,
        color: cfg.fg,
        bgcolor: cfg.bg,
        whiteSpace: 'nowrap',
      }}
    >
      {Icon ? (
        <Icon size={11} strokeWidth={2.5} style={{ flexShrink: 0 }} />
      ) : (
        <Box component="span" sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: cfg.fg, flexShrink: 0 }} />
      )}
      {text}
    </Box>
  );
};

export default StatusBadge;
