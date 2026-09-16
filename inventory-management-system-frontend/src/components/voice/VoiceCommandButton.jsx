import { useState } from 'react';
import { IconButton, Tooltip, Snackbar, Alert } from '@mui/material';
import { Mic } from 'lucide-react';
import VoiceCommandDialog from './VoiceCommandDialog';
import { colors } from '../../theme/tokens';

/**
 * Global mic button (lives in the navbar). Opens the voice-command dialog and
 * shows a result toast. Inventory/Components pages listen for the
 * 'inventory:changed' event the dialog fires, so they refresh automatically.
 */
const VoiceCommandButton = () => {
  const [open, setOpen] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '' });

  return (
    <>
      <Tooltip title="Voice command — add or remove stock">
        <IconButton
          size="small"
          onClick={() => setOpen(true)}
          aria-label="Voice command"
          sx={{ color: colors.primary, '&:hover': { bgcolor: colors.primarySoft } }}
        >
          <Mic size={19} />
        </IconButton>
      </Tooltip>

      <VoiceCommandDialog
        open={open}
        onClose={() => setOpen(false)}
        onDone={(message) => setSnack({ open: true, message })}
      />

      <Snackbar
        open={snack.open}
        autoHideDuration={5000}
        onClose={() => setSnack({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setSnack({ open: false, message: '' })}>
          {snack.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default VoiceCommandButton;
