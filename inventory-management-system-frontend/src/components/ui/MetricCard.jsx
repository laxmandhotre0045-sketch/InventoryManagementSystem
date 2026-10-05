import { Card, Box, Typography, Skeleton } from '@mui/material';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { colors, tints } from '../../theme/tokens';

const toneMap = {
  primary: tints.blue,
  info: tints.blue,
  success: tints.green,
  warning: tints.orange,
  danger: tints.red,
  purple: tints.purple,
  neutral: { bg: '#F6F5F2', border: colors.border, fg: colors.textSecondary, chip: '#FFFFFF' },
};

// Hex colour with an alpha channel appended, for tinted glows (#2C5C9E -> #2C5C9E40).
const alpha = (hex, a) => `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`;

/**
 * The "bright" variant: a luminous card that catches the light. Opt-in through `glow`,
 * so every other screen that uses MetricCard keeps its calm, flat look.
 *
 * - a white-to-tint gradient face with a soft glass highlight across the top edge,
 * - a coloured glow underneath in the card's own tone, which strengthens on hover,
 * - a lit icon chip, and a single light sweep across the card on hover.
 */
const glowSx = (t) => ({
  position: 'relative',
  overflow: 'hidden',
  background: `linear-gradient(145deg, #FFFFFF 0%, ${t.bg} 55%, ${t.chip} 100%)`,
  border: `1px solid ${alpha(t.fg, 0.16)}`,
  boxShadow: `0 1px 0 rgba(255,255,255,0.9) inset, 0 10px 28px -14px ${alpha(t.fg, 0.45)}`,
  // Glass highlight: a white wash fading out across the top of the card.
  '&::before': {
    content: '""', position: 'absolute', inset: 0, pointerEvents: 'none',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 46%)',
  },
  // Light sweep: a soft diagonal band parked off the left edge, run across on hover.
  '&::after': {
    content: '""', position: 'absolute', top: 0, bottom: 0, left: '-60%', width: '45%', pointerEvents: 'none',
    background: 'linear-gradient(105deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.75) 50%, rgba(255,255,255,0) 100%)',
    transform: 'skewX(-18deg)',
    transition: 'left .9s cubic-bezier(.4,0,.2,1)',
  },
  '& > *': { position: 'relative', zIndex: 1 },
  '&:hover': {
    transform: 'translateY(-3px)',
    borderColor: alpha(t.fg, 0.32),
    boxShadow: `0 1px 0 rgba(255,255,255,0.9) inset, 0 18px 40px -14px ${alpha(t.fg, 0.6)}`,
  },
  '&:hover::after': { left: '130%' },
  '@media (prefers-reduced-motion: reduce)': {
    '&::after': { display: 'none' },
    '&:hover': { transform: 'none' },
  },
});

// Executive KPI card with a soft pastel tint, prominent value, and generous space.
const MetricCard = ({ icon: Icon, title, value, trend, caption, tone = 'primary', loading = false, glow = false }) => {
  const t = toneMap[tone] || toneMap.primary;
  const trendUp = trend?.direction !== 'down';
  const TrendIcon = trendUp ? TrendingUp : TrendingDown;
  const trendColor = trendUp ? colors.success : colors.danger;

  return (
    <Card
      sx={{
        height: '100%',
        p: 2.25,
        bgcolor: t.bg,
        border: `1px solid ${t.border}`,
        boxShadow: 'none',
        transition: 'transform .22s cubic-bezier(.4,0,.2,1), box-shadow .22s ease, border-color .22s ease',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 20px rgba(16,24,40,0.07)', borderColor: t.chip },
        ...(glow ? glowSx(t) : {}),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, mb: 1.5 }}>
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 550, color: colors.textSecondary, lineHeight: 1.4 }}>
          {title}
        </Typography>
        {Icon && (
          <Box
            sx={{
              width: 34, height: 34, borderRadius: '9px', display: 'grid', placeItems: 'center',
              bgcolor: t.chip, color: t.fg, flexShrink: 0,
              // Lit chip: white rim plus a halo in the card's tone.
              ...(glow && {
                bgcolor: '#FFFFFF',
                boxShadow: `0 0 0 3px ${alpha(t.fg, 0.10)}, 0 6px 16px -4px ${alpha(t.fg, 0.55)}`,
              }),
            }}
          >
            <Icon size={17} strokeWidth={2} />
          </Box>
        )}
      </Box>

      {loading ? (
        <Skeleton variant="text" width={96} height={34} />
      ) : (
        // The KPI figure stays deliberately the largest text on the page, but at
        // 28px rather than 48px it reads as a metric instead of a headline.
        <Typography sx={{ fontSize: '1.75rem', fontWeight: 650, lineHeight: 1.15, letterSpacing: '-0.022em', color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
          {value ?? '—'}
        </Typography>
      )}

      {trend && !loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75 }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, color: trendColor, fontWeight: 600, fontSize: '0.75rem' }}>
            <TrendIcon size={13} />
            {trend.value}
          </Box>
          {trend.label && <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted }}>{trend.label}</Typography>}
        </Box>
      )}

      {caption && !trend && !loading && (
        <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted, mt: 0.75, lineHeight: 1.45 }}>{caption}</Typography>
      )}
    </Card>
  );
};

export default MetricCard;
