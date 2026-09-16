import { useEffect, useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  IconButton, CircularProgress, TextField, Grid, Alert, Chip, Divider,
} from '@mui/material';
import { Mic, Square, X, Check, Sparkles, RotateCcw } from 'lucide-react';
import { transcribeAudio, interpretVoiceCommand, executeVoiceCommand } from '../../api/voiceApi';
import { CURRENCY_SYMBOL } from '../../utils/currency';
import { colors } from '../../theme/tokens';

// We record audio in the browser and transcribe it server-side (OpenAI Whisper),
// instead of the flaky, Chrome/Google-only Web Speech API. This works in Chrome,
// Edge, Firefox and recent Safari. getUserMedia still needs a secure context
// (localhost or https).
const RECORDER_SUPPORTED = typeof window !== 'undefined'
  && typeof window.MediaRecorder !== 'undefined'
  && !!navigator.mediaDevices?.getUserMedia;

const MAX_RECORD_MS = 15000; // safety auto-stop

const ACTION_LABEL = {
  ADD_STOCK: 'Add stock',
  REMOVE_STOCK: 'Remove stock',
  CREATE_COMPONENT: 'Create component',
};
const actionColor = (a) =>
  a === 'REMOVE_STOCK' ? { fg: colors.danger, bg: colors.dangerSoft || '#FDECEC' }
    : a === 'CREATE_COMPONENT' ? { fg: colors.warning, bg: colors.warningSoft }
      : { fg: colors.success, bg: colors.successSoft };

const EXAMPLES = [
  'Add 50 BC547 transistors',
  'Remove 10 ESP32 from stock',
  'Create a new component DHT11 sensor, quantity 20, category Sensors',
];

const pickMimeType = () => {
  const prefs = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const t of prefs) {
    if (window.MediaRecorder?.isTypeSupported?.(t)) return t;
  }
  return '';
};

const VoiceCommandDialog = ({ open, onClose, onDone }) => {
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const autoStopRef = useRef(null);
  const startTimeRef = useRef(0);
  const MIN_RECORD_MS = 700; // guard against an accidental double-tap sending near-empty audio

  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [phase, setPhase] = useState('capture'); // capture | transcribing | interpreting | review | executing
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [interp, setInterp] = useState(null);
  // Editable fields on the confirmation card.
  const [qty, setQty] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [unitPrice, setUnitPrice] = useState('');

  const cleanupStream = () => {
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* no-op */ }
    streamRef.current = null;
  };

  const resetAll = () => {
    try { recorderRef.current?.state === 'recording' && recorderRef.current.stop(); } catch { /* no-op */ }
    cleanupStream();
    setRecording(false); setTranscript(''); setPhase('capture');
    setError(''); setHint(''); setInterp(null); setQty(''); setCategory(''); setUnit(''); setUnitPrice('');
  };

  useEffect(() => {
    if (open) resetAll();
    return () => { try { recorderRef.current?.stop(); } catch { /* no-op */ } cleanupStream(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const startRecording = async () => {
    if (!RECORDER_SUPPORTED) return;
    setError(''); setHint(''); setTranscript(''); setInterp(null); setPhase('capture');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        setError('Microphone access is blocked. Click the icon in the address bar, allow the mic, and try again.');
      } else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
        setError('No microphone was found. Connect one (and make sure it isn’t muted), then try again.');
      } else {
        setError(`Could not open the microphone (${err?.name || 'error'}).`);
      }
      return;
    }
    streamRef.current = stream;
    chunksRef.current = [];
    const mimeType = pickMimeType();
    let recorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      recorder = new MediaRecorder(stream);
    }
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      cleanupStream();
      setRecording(false);
      const elapsed = Date.now() - (startTimeRef.current || 0);
      const type = recorder.mimeType || mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type });
      if (!blob.size || elapsed < MIN_RECORD_MS) {
        setHint('That was too short. Tap the mic, say the whole command (e.g. “add 50 ESP32”), then tap the square to stop.');
        setPhase('capture');
        return;
      }
      const ext = type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : 'webm';
      setPhase('transcribing');
      try {
        const res = await transcribeAudio(blob, `command.${ext}`);
        const text = (res.data?.transcript || '').trim();
        if (!text) {
          setHint("I couldn't make out any words. Please try again, speaking clearly — or type your command.");
          setPhase('capture');
          return;
        }
        setTranscript(text);
        interpret(text);
      } catch (err) {
        setError(err.response?.data?.message || 'Could not transcribe the audio. Please try again or type the command.');
        setPhase('capture');
      }
    };

    setRecording(true);
    startTimeRef.current = Date.now();
    recorder.start();
    // Safety auto-stop so a forgotten recording can't run forever.
    autoStopRef.current = setTimeout(() => {
      try { recorder.state === 'recording' && recorder.stop(); } catch { /* no-op */ }
    }, MAX_RECORD_MS);
  };

  const stopRecording = () => {
    try { recorderRef.current?.state === 'recording' && recorderRef.current.stop(); } catch { /* no-op */ }
  };

  const interpret = async (text) => {
    const said = (text ?? transcript).trim();
    if (!said) { setError('Say or type a command first.'); return; }
    setPhase('interpreting'); setError(''); setHint('');
    try {
      const res = await interpretVoiceCommand(said);
      const d = res.data;
      setInterp(d);
      setQty(d.quantity ?? '');
      setCategory(d.category ?? '');
      setUnit(d.unit ?? '');
      setUnitPrice(d.unitPrice ?? '');
      setPhase('review');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not interpret the command. Please try again.');
      setPhase('capture');
    }
  };

  const isRemove = interp?.action === 'REMOVE_STOCK';
  const isCreate = interp?.action === 'CREATE_COMPONENT';
  const nothingToRemove = isRemove && !interp?.matchedComponentId;
  const canConfirm = interp?.understood && !nothingToRemove && Number(qty) > 0 && phase === 'review';

  const handleConfirm = async () => {
    if (!interp) return;
    setPhase('executing'); setError('');
    try {
      const payload = {
        action: interp.action,
        componentId: interp.matchedComponentId ?? null,
        componentName: interp.itemName,
        quantity: Number(qty),
        categoryName: category || null,
        unit: unit || null,
        unitPrice: unitPrice === '' ? null : Number(unitPrice),
        minimumQuantity: null,
        description: interp.specifications || null,
        remarks: `Voice: "${interp.rawTranscript || transcript}"`,
      };
      const res = await executeVoiceCommand(payload);
      const msg = res.data?.message || res.message || 'Done.';
      window.dispatchEvent(new CustomEvent('inventory:changed'));
      onDone?.(msg);
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not apply the command. No changes were made.');
      setPhase('review');
    }
  };

  const busy = phase === 'transcribing' || phase === 'interpreting' || phase === 'executing';
  const busyLabel = phase === 'transcribing' ? 'Transcribing…' : phase === 'interpreting' ? 'Understanding…' : '';

  return (
    <Dialog open={open} onClose={busy || recording ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Sparkles size={22} color={colors.primary} />
        <Box sx={{ flexGrow: 1 }}>Voice Command</Box>
        <IconButton onClick={onClose} disabled={busy || recording}><X size={20} /></IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {!error && hint && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setHint('')}>{hint}</Alert>}

        {/* Mic / record */}
        <Box sx={{ display: 'grid', placeItems: 'center', gap: 1.5, py: 1 }}>
          {RECORDER_SUPPORTED ? (
            <IconButton
              onClick={recording ? stopRecording : startRecording}
              disabled={busy}
              sx={{
                width: 84, height: 84, color: '#fff',
                bgcolor: recording ? colors.danger : colors.primary,
                animation: recording ? 'vcpulse 1.4s ease-in-out infinite' : 'none',
                '&:hover': { bgcolor: recording ? colors.danger : colors.primaryHover },
                '@keyframes vcpulse': {
                  '0%,100%': { boxShadow: `0 0 0 6px ${colors.dangerSoft || 'rgba(220,38,38,0.12)'}` },
                  '50%': { boxShadow: '0 0 0 16px rgba(220,38,38,0.04)' },
                },
              }}
            >
              {recording ? <Square size={30} /> : <Mic size={34} />}
            </IconButton>
          ) : (
            <Chip label="Recording isn't supported here — type your command below"
              sx={{ bgcolor: colors.warningSoft, color: colors.warning, fontWeight: 600 }} />
          )}
          <Typography sx={{ fontSize: '0.875rem', color: colors.textSecondary }}>
            {recording ? 'Recording… tap the square to stop'
              : busy ? busyLabel
                : RECORDER_SUPPORTED ? 'Tap the mic, speak, then tap again to stop — or type below' : ''}
          </Typography>
        </Box>

        {/* Transcript / typed command */}
        <TextField
          fullWidth size="small" sx={{ mt: 1 }}
          label="Command"
          placeholder={EXAMPLES[0]}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !busy && !recording) interpret(); }}
          disabled={recording || busy}
        />
        {phase === 'capture' && !recording && (
          <>
            <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {EXAMPLES.map((ex) => (
                <Chip key={ex} label={ex} size="small" variant="outlined"
                  onClick={() => setTranscript(ex)}
                  sx={{ fontSize: '0.7rem', cursor: 'pointer' }} />
              ))}
            </Box>
            <Button sx={{ mt: 1.5 }} variant="outlined" fullWidth disabled={!transcript.trim() || busy}
              onClick={() => interpret()}>
              Interpret command
            </Button>
          </>
        )}

        {busy && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 2 }}>
            <CircularProgress size={20} /><Typography sx={{ color: colors.textSecondary }}>{busyLabel || 'Working…'}</Typography>
          </Box>
        )}

        {/* Review / confirm */}
        {phase === 'review' && interp && (
          <Box sx={{ mt: 2 }}>
            <Divider sx={{ mb: 2 }} />
            {!interp.understood ? (
              <Alert severity="warning">
                {interp.warning || "I couldn't understand that as an inventory command."}
              </Alert>
            ) : (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Chip size="small" label={ACTION_LABEL[interp.action] || interp.action}
                    sx={{ fontWeight: 700, bgcolor: actionColor(interp.action).bg, color: actionColor(interp.action).fg }} />
                  <Typography sx={{ fontWeight: 600 }} noWrap>{interp.matchedComponentName || interp.itemName}</Typography>
                </Box>

                <Typography sx={{ fontSize: '0.9375rem', mb: 2 }}>
                  {interp.confirmationText}
                </Typography>

                {interp.warning && (
                  <Alert severity={nothingToRemove ? 'error' : 'warning'} sx={{ mb: 2 }}>{interp.warning}</Alert>
                )}

                {!nothingToRemove && (
                  <Grid container spacing={1.5}>
                    <Grid item xs={6}>
                      <TextField fullWidth size="small" type="number" label="Quantity"
                        value={qty} onChange={(e) => setQty(e.target.value)} />
                    </Grid>
                    {isCreate && (
                      <>
                        <Grid item xs={6}>
                          <TextField fullWidth size="small" label="Category"
                            value={category} onChange={(e) => setCategory(e.target.value)}
                            placeholder="Uncategorized" />
                        </Grid>
                        <Grid item xs={6}>
                          <TextField fullWidth size="small" label="Unit"
                            value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pcs" />
                        </Grid>
                        <Grid item xs={6}>
                          <TextField fullWidth size="small" type="number" label={`Unit Price (${CURRENCY_SYMBOL})`}
                            value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
                        </Grid>
                      </>
                    )}
                  </Grid>
                )}
              </>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        {phase === 'review' && (
          <Button variant="text" startIcon={<RotateCcw size={16} />} onClick={resetAll} disabled={busy}>
            Start over
          </Button>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="text" onClick={onClose} disabled={busy || recording}>Cancel</Button>
        <Button variant="contained" onClick={handleConfirm} disabled={!canConfirm}
          startIcon={phase === 'executing' ? <CircularProgress size={16} color="inherit" /> : <Check size={16} />}>
          {phase === 'executing' ? 'Applying…' : 'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VoiceCommandDialog;
