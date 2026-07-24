import { Box } from '@mui/material';
import {
  Check, AlertTriangle, XCircle, Clock, Ban, Wrench, Activity, ArrowDownLeft, ArrowUpRight,
} from 'lucide-react';
import { statusPalette } from '../../theme/tokens';

// Contextual icons per status (subtle, 13px).
const iconMap = {
  active: Activity,
  available: Check,
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
        gap: 0.625,
        px: 1.5,
        py: '5px',
        borderRadius: 999,
        fontSize: '0.875rem',
        fontWeight: 600,
        lineHeight: 1.3,
        color: cfg.fg,
        bgcolor: cfg.bg,
        whiteSpace: 'nowrap',
      }}
    >
      {Icon ? (
        <Icon size={13} strokeWidth={2.5} style={{ flexShrink: 0 }} />
      ) : (
        <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: cfg.fg, flexShrink: 0 }} />
      )}
      {text}
    </Box>
  );
};

export default StatusBadge;
