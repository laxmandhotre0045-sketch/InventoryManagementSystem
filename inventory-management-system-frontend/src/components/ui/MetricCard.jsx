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

// Executive KPI card with a soft pastel tint, prominent value, and generous space.
const MetricCard = ({ icon: Icon, title, value, trend, caption, tone = 'primary', loading = false }) => {
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
