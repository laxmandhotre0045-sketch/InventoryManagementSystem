import { Box, Typography, Button } from '@mui/material';
import { Inbox, Plus } from 'lucide-react';
import { colors } from '../../theme/tokens';

// Beautiful empty state used in place of blank tables / sections.
const EmptyState = ({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  description = 'Get started by adding your first item.',
  actionLabel,
  onAction,
  actionIcon: ActionIcon = Plus,
  dense = false,
}) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      py: dense ? 5 : 8,
      px: 3,
    }}
  >
    <Box
      sx={{
        width: 64,
        height: 64,
        borderRadius: '18px',
        display: 'grid',
        placeItems: 'center',
        bgcolor: colors.primarySoft,
        color: colors.primary,
        mb: 2.5,
      }}
    >
      <Icon size={30} strokeWidth={1.75} />
    </Box>
    <Typography variant="h6" sx={{ fontSize: '1.0625rem', fontWeight: 600, mb: 0.75 }}>
      {title}
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, mb: actionLabel ? 3 : 0 }}>
      {description}
    </Typography>
    {actionLabel && onAction && (
      <Button variant="contained" startIcon={<ActionIcon size={18} />} onClick={onAction}>
        {actionLabel}
      </Button>
    )}
  </Box>
);

export default EmptyState;
