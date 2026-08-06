import { Box, Typography } from '@mui/material';

// Section heading with optional action on the right (e.g. "View all").
const SectionHeader = ({ title, subtitle, action, sx }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2, ...sx }}>
    <Box>
      <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.008em' }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.25 }}>
          {subtitle}
        </Typography>
      )}
    </Box>
    {action}
  </Box>
);

export default SectionHeader;
