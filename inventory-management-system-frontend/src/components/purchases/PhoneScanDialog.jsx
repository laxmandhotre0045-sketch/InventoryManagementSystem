import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  IconButton, CircularProgress, Alert, TextField, Chip,
} from '@mui/material';
import { X, Smartphone, RefreshCw } from 'lucide-react';
import { createCaptureSession, getCaptureStatus, getCaptureResult } from '../../api/mobileCaptureApi';
import { colors } from '../../theme/tokens';
import { normalizeBase, classifyBase, defaultBase, buildCaptureUrl } from '../../utils/phoneCaptureUrl';

const BASE_STORAGE_KEY = 'mobileCaptureBase';

const readSavedBase = () => {
  try { return localStorage.getItem(BASE_STORAGE_KEY) || ''; } catch { return ''; }
};

const PhoneScanDialog = ({ open, onClose, onResult }) => {
  const [sessionId, setSessionId] = useState('');
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | waiting | processing | done | error
  const [baseInput, setBaseInput] = useState(() => readSavedBase() || defaultBase());
  // Only surfaced when there is nothing sensible to default to, or on request.
  const [addressOpen, setAddressOpen] = useState(() => !(readSavedBase() || defaultBase()));
  const pollRef = useRef(null);

  const base = normalizeBase(baseInput);
  const baseClass = classifyBase(base);
  const url = buildCaptureUrl(sessionId, base);

  const updateBase = (v) => {
    setBaseInput(v);
    try { localStorage.setItem(BASE_STORAGE_KEY, v.trim()); } catch { /* ignore */ }
  };

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  // Create a session when the dialog opens.
  useEffect(() => {
    if (!open) return undefined;
    setError(''); setPhase('waiting'); setQr(''); setSessionId('');
    createCaptureSession()
      .then((r) => setSessionId(r.data?.sessionId || ''))
      .catch(() => { setError('Could not start a phone session. Please try again.'); setPhase('error'); });
    return () => stopPoll();
  }, [open]);

  // Render the QR whenever the URL becomes available/changes.
  useEffect(() => {
    if (!url) { setQr(''); return; }
    QRCode.toDataURL(url, { width: 240, margin: 1 })
      .then(setQr)
      .catch(() => setQr(''));
  }, [url]);

  // Poll the session status; when the phone's upload is extracted, hand the
  // result to the parent (which opens the review dialog).
  useEffect(() => {
    if (!open || !sessionId) return undefined;
    stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const d = (await getCaptureStatus(sessionId)).data;
        const s = d?.status;
        if (s === 'PROCESSING') setPhase('processing');
        else if (s === 'READY') {
          stopPoll();
          const res = await getCaptureResult(sessionId);
          if (res.success && res.data) {
            setPhase('done');
            onResult?.(res.data);
          }
        } else if (s === 'EXPIRED' || s === 'NOT_FOUND') {
          stopPoll(); setError('This code expired. Close and try again.'); setPhase('error');
        } else if (s === 'ERROR') {
          // The server knows whether the photo was unreadable or simply wasn't an
          // invoice — two problems with different fixes, so show the real one.
          stopPoll();
          setError(d?.error || 'The phone photo could not be read. Ask them to retake it.');
          setPhase('error');
        }
      } catch { /* transient — keep polling */ }
    }, 2000);
    return () => stopPoll();
  }, [open, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Smartphone size={20} color={colors.primary} />
        <Box sx={{ flexGrow: 1 }}>Capture on your phone</Box>
        <IconButton onClick={onClose}><X size={20} /></IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ textAlign: 'center' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {(addressOpen || baseClass.level === 'error') && (
          <>
            <Alert severity={baseClass.level === 'error' ? 'warning' : 'info'} sx={{ mb: 2, textAlign: 'left' }}>
              {baseClass.note || 'Enter the address your phone should open.'}
            </Alert>

            <TextField
              fullWidth size="small" sx={{ mb: 0.5 }}
              label="Address your phone will open"
              placeholder="192.168.1.44:8090"
              value={baseInput}
              onChange={(e) => updateBase(e.target.value)}
              error={Boolean(baseInput) && baseClass.level === 'error'}
            />
            <Typography sx={{ color: colors.textMuted, fontSize: '0.72rem', textAlign: 'left', mb: 1.5 }}>
              Include the port for a Wi-Fi address (e.g. <code>192.168.1.44:8090</code>).
            </Typography>
          </>
        )}

        <Typography sx={{ color: colors.textSecondary, mb: 2, fontSize: '0.9rem' }}>
          Scan this with your phone camera, then take a photo of the invoice.
        </Typography>

        <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 240 }}>
          {qr ? (
            <Box component="img" src={qr} alt="Scan to capture on phone"
              sx={{ width: 240, height: 240, borderRadius: 2, border: `1px solid ${colors.border}` }} />
          ) : (
            <Box sx={{ display: 'grid', placeItems: 'center', gap: 1.5 }}>
              <CircularProgress />
              <Typography sx={{ color: colors.textMuted, fontSize: '0.85rem' }}>
                {!base ? 'Enter an address above to show the code' : 'Preparing code…'}
              </Typography>
            </Box>
          )}
        </Box>

        {!addressOpen && baseClass.level !== 'error' && (
          <Button size="small" onClick={() => setAddressOpen(true)}
            sx={{ mt: 1, fontSize: '0.75rem', color: colors.textMuted, textTransform: 'none' }}>
            Phone can't open it? Use a Wi-Fi address
          </Button>
        )}

        <Box sx={{ mt: 2 }}>
          {phase === 'processing' ? (
            <Chip icon={<CircularProgress size={14} />} label="Reading the photo from your phone…"
              sx={{ bgcolor: colors.primarySoft, color: colors.primary, fontWeight: 600 }} />
          ) : phase === 'done' ? (
            <Chip label="Received — opening for review…" sx={{ bgcolor: colors.successSoft, color: colors.success, fontWeight: 600 }} />
          ) : (
            <Chip icon={<RefreshCw size={14} />} label="Waiting for your phone…"
              sx={{ bgcolor: colors.canvas, color: colors.textSecondary, fontWeight: 600 }} />
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PhoneScanDialog;
