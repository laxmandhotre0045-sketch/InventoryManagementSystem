import { Card, Box, Typography } from '@mui/material';
import { colors } from '../../theme/tokens';

// Container for charts and rich panels: title, optional subtitle/action, body.
const ChartCard = ({ title, subtitle, action, children, padding = 2.5, sx }) => (
  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', ...sx }}>
    {(title || action) && (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          px: padding,
          pt: padding,
          pb: subtitle ? 1.5 : 2,
        }}
      >
        <Box>
          {title && (
            <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: colors.textPrimary, letterSpacing: '-0.008em' }}>{title}</Typography>
          )}
          {subtitle && (
            <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted, mt: 0.25 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {action}
      </Box>
    )}
    <Box sx={{ flexGrow: 1, px: padding, pb: padding, pt: title ? 0 : padding, minWidth: 0 }}>{children}</Box>
  </Card>
);

export default ChartCard;
