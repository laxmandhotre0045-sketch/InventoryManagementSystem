import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  IconButton, CircularProgress, Alert, TextField, Chip,
} from '@mui/material';
import { X, Smartphone, RefreshCw } from 'lucide-react';
import { createCaptureSession, getCaptureStatus, getCaptureResult } from '../../api/mobileCaptureApi';
import { colors } from '../../theme/tokens';

const HOST_STORAGE_KEY = 'mobileCaptureHost';

// A phone on the same Wi-Fi needs a private LAN IP. Flag the addresses that
// famously don't work: localhost, APIPA (169.254), Tailscale/CGNAT (100.64/10),
// and anything that isn't a private range.
// level: 'ok' (valid), 'info' (usable but conditional, e.g. Tailscale), 'error' (won't work)
const classifyHost = (h) => {
  if (!h) return { level: 'error', warn: '' };
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') {
    return { level: 'error', warn: 'localhost can’t be reached from a phone. Use your PC’s Wi-Fi IP, e.g. 192.168.x.x.' };
  }
  if (/^169\.254\./.test(h)) {
    return { level: 'error', warn: 'That’s an auto-config address that won’t work. Use your PC’s Wi-Fi IP (192.168.x.x).' };
  }
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h)) {
    return { level: 'info', warn: 'Tailscale/VPN address — works from anywhere, but only if your phone also has Tailscale installed and connected to the same account.' };
  }
  if (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) {
    return { level: 'ok', warn: '' };
  }
  return { level: 'error', warn: 'Use your PC’s local Wi-Fi IP (192.168.x.x or 10.x.x.x), with the phone on the same Wi-Fi.' };
};

const readSavedHost = () => {
  try { return localStorage.getItem(HOST_STORAGE_KEY) || ''; } catch { return ''; }
};

const buildUrl = (sessionId, host) => {
  if (!sessionId || !host) return '';
  const { protocol, port } = window.location;
  const p = port ? `:${port}` : '';
  return `${protocol}//${host}${p}/m/capture?s=${sessionId}`;
};

const PhoneScanDialog = ({ open, onClose, onResult }) => {
  const [sessionId, setSessionId] = useState('');
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | waiting | processing | done | error
  const detectedHost = window.location.hostname;
  const [host, setHost] = useState(() => readSavedHost()
    || (classifyHost(detectedHost).level !== 'error' ? detectedHost : ''));
  const pollRef = useRef(null);
  const hostClass = classifyHost(host);
  const url = buildUrl(sessionId, host);

  const updateHost = (v) => {
    const val = v.trim();
    setHost(val);
    try { localStorage.setItem(HOST_STORAGE_KEY, val); } catch { /* ignore */ }
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
        const s = (await getCaptureStatus(sessionId)).data?.status;
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
          stopPoll(); setError('The phone photo could not be read. Ask them to retake it.'); setPhase('error');
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

        <Alert severity="info" sx={{ mb: 2, textAlign: 'left' }}>
          Your <b>phone must be on the same Wi-Fi</b> as this computer (not mobile data),
          and this must be your PC’s <b>Wi-Fi IP</b> — usually <code>192.168.x.x</code>.
          Find it with <code>ipconfig</code> → IPv4 Address. Avoid Tailscale/VPN addresses.
        </Alert>

        <TextField
          fullWidth size="small" sx={{ mb: 0.5 }}
          label="Computer’s Wi-Fi IP address"
          placeholder="192.168.1.40"
          value={host}
          onChange={(e) => updateHost(e.target.value)}
          error={Boolean(host) && hostClass.level === 'error'}
        />
        {host && hostClass.warn && (
          <Typography sx={{ color: hostClass.level === 'error' ? colors.danger : colors.textSecondary,
            fontSize: '0.75rem', textAlign: 'left', mb: 1.5 }}>
            {hostClass.warn}
          </Typography>
        )}
        {(!host || !hostClass.warn) && (
          <Typography sx={{ color: colors.textMuted, fontSize: '0.72rem', textAlign: 'left', mb: 1.5 }}>
            Detected this page’s host: <code>{detectedHost}</code>
          </Typography>
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
                {!host ? 'Enter your Wi-Fi IP above to show the code' : 'Preparing code…'}
              </Typography>
            </Box>
          )}
        </Box>

        {url && (
          <Typography sx={{ mt: 1.5, fontSize: '0.7rem', color: colors.textMuted, wordBreak: 'break-all' }}>
            {url}
          </Typography>
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
