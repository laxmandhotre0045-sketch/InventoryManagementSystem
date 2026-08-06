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
      py: dense ? 4 : 6,
      px: 3,
    }}
  >
    <Box
      sx={{
        width: 44,
        height: 44,
        borderRadius: '12px',
        display: 'grid',
        placeItems: 'center',
        bgcolor: colors.primarySoft,
        color: colors.primary,
        mb: 1.5,
      }}
    >
      <Icon size={21} strokeWidth={1.75} />
    </Box>
    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 0.5 }}>
      {title}
    </Typography>
    <Typography sx={{ fontSize: '0.8125rem', color: colors.textSecondary, maxWidth: 340, mb: actionLabel ? 2 : 0 }}>
      {description}
    </Typography>
    {actionLabel && onAction && (
      <Button variant="contained" size="small" startIcon={<ActionIcon size={15} />} onClick={onAction}>
        {actionLabel}
      </Button>
    )}
  </Box>
);

export default EmptyState;
