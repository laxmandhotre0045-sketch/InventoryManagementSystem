import {
  Dialog, DialogContent, DialogActions, Button, Box, Typography,
} from '@mui/material';
import { AlertTriangle } from 'lucide-react';
import { colors } from '../../theme/tokens';

const ConfirmDialog = ({ open, title, message, onConfirm, onCancel, loading = false, confirmText = 'Confirm' }) => (
  <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
    <DialogContent sx={{ pt: 3.5, px: 3, textAlign: 'center' }}>
      <Box
        sx={{
          width: 56, height: 56, borderRadius: '16px', display: 'grid', placeItems: 'center',
          bgcolor: colors.dangerSoft, color: colors.danger, mx: 'auto', mb: 2,
        }}
      >
        <AlertTriangle size={28} />
      </Box>
      <Typography sx={{ fontSize: '1.125rem', fontWeight: 600, mb: 0.75 }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary">{message}</Typography>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 3, pt: 1, justifyContent: 'center' }}>
      <Button onClick={onCancel} variant="outlined" disabled={loading} fullWidth>Cancel</Button>
      <Button onClick={onConfirm} color="error" variant="contained" disabled={loading} fullWidth>
        {loading ? 'Processing…' : confirmText}
      </Button>
    </DialogActions>
  </Dialog>
);

export default ConfirmDialog;
