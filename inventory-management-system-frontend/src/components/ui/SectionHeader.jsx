import { Box, Typography } from '@mui/material';

// Section heading with optional action on the right (e.g. "View all").
const SectionHeader = ({ title, subtitle, action, sx }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2, ...sx }}>
    <Box>
      <Typography variant="h3" sx={{ fontSize: '1.125rem', fontWeight: 600 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {subtitle}
        </Typography>
      )}
    </Box>
    {action}
  </Box>
);

export default SectionHeader;
