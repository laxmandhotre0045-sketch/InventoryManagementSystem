import {
  Dialog, DialogContent, DialogActions, Button, Box, Typography,
} from '@mui/material';
import { AlertTriangle } from 'lucide-react';
import { colors } from '../../theme/tokens';

const ConfirmDialog = ({ open, title, message, onConfirm, onCancel, loading = false, confirmText = 'Confirm' }) => (
  <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
    <DialogContent sx={{ pt: 3, px: 3, textAlign: 'center' }}>
      <Box
        sx={{
          width: 42, height: 42, borderRadius: '12px', display: 'grid', placeItems: 'center',
          bgcolor: colors.dangerSoft, color: colors.danger, mx: 'auto', mb: 1.5,
        }}
      >
        <AlertTriangle size={21} />
      </Box>
      <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, mb: 0.5 }}>{title}</Typography>
      <Typography sx={{ fontSize: '0.8125rem' }} color="text.secondary">{message}</Typography>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, justifyContent: 'center' }}>
      <Button onClick={onCancel} variant="outlined" disabled={loading} fullWidth>Cancel</Button>
      <Button onClick={onConfirm} color="error" variant="contained" disabled={loading} fullWidth>
        {loading ? 'Processing…' : confirmText}
      </Button>
    </DialogActions>
  </Dialog>
);

export default ConfirmDialog;
