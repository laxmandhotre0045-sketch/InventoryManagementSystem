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
        p: 3.5,
        bgcolor: t.bg,
        border: `1px solid ${t.border}`,
        boxShadow: 'none',
        transition: 'transform .22s cubic-bezier(.4,0,.2,1), box-shadow .22s ease, border-color .22s ease',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 14px 32px rgba(16,24,40,0.09)', borderColor: t.chip },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2.75 }}>
        <Typography sx={{ fontSize: '1.1875rem', fontWeight: 500, color: colors.textSecondary }}>
          {title}
        </Typography>
        {Icon && (
          <Box
            sx={{
              width: 52, height: 52, borderRadius: '14px', display: 'grid', placeItems: 'center',
              bgcolor: t.chip, color: t.fg, flexShrink: 0,
            }}
          >
            <Icon size={26} strokeWidth={2} />
          </Box>
        )}
      </Box>

      {loading ? (
        <Skeleton variant="text" width={120} height={56} />
      ) : (
        <Typography sx={{ fontSize: '3rem', fontWeight: 700, lineHeight: 1.02, letterSpacing: '-0.028em', color: colors.textPrimary }}>
          {value ?? '—'}
        </Typography>
      )}

      {trend && !loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5 }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, color: trendColor, fontWeight: 600, fontSize: '0.9375rem' }}>
            <TrendIcon size={16} />
            {trend.value}
          </Box>
          {trend.label && <Typography sx={{ fontSize: '0.9375rem', color: colors.textMuted }}>{trend.label}</Typography>}
        </Box>
      )}

      {caption && !trend && !loading && (
        <Typography sx={{ fontSize: '1.0625rem', color: colors.textMuted, mt: 1.75 }}>{caption}</Typography>
      )}
    </Card>
  );
};

export default MetricCard;
