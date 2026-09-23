import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Button, Typography, CircularProgress, Alert } from '@mui/material';
import { Camera, Upload, CheckCircle2, RefreshCw } from 'lucide-react';
import { uploadCaptureImage, getCaptureStatus } from '../api/mobileCaptureApi';
import { colors } from '../theme/tokens';

/**
 * Shrink a phone photo before upload: full-res camera images are several MB and
 * make both the upload and the AI vision call slow (and prone to timeouts). We
 * cap the longest edge and re-encode as JPEG — invoice text stays readable while
 * the payload drops ~5–10x. Orientation is baked in so the invoice isn't sideways.
 */
const downscaleImage = async (file, maxDim = 2000, quality = 0.92) => {
  try {
    if (!/^image\//i.test(file.type)) return file;
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxDim / longest);
    // Already small and modest size — send as-is.
    if (scale === 1 && file.size < 1.2 * 1024 * 1024) { bitmap.close?.(); return file; }
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob) return file;
    const base = (file.name || 'invoice').replace(/\.[^.]+$/, '');
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file; // any failure: fall back to the original
  }
};

/**
 * Phone-facing page opened by scanning the desktop's QR code. It is public (no
 * login) — the session id in the URL is the capability.
 *
 * Uses a file input with capture="environment" rather than getUserMedia, because
 * the app is typically served over plain HTTP on the LAN, where getUserMedia is
 * blocked but the native camera file-picker still works.
 */
const MobileCapturePage = () => {
  const [params] = useSearchParams();
  const sessionId = params.get('s') || params.get('session') || '';
  const fileRef = useRef(null);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [phase, setPhase] = useState('pick'); // pick | uploading | done
  const [error, setError] = useState('');
  const [sessionDead, setSessionDead] = useState(false);

  // Check the session as soon as the page loads, so an expired QR is caught
  // BEFORE the user bothers taking a photo.
  useEffect(() => {
    if (!sessionId) return;
    getCaptureStatus(sessionId)
      .then((r) => {
        const s = r.data?.status;
        if (s === 'EXPIRED' || s === 'NOT_FOUND') {
          setSessionDead(true);
          setError('This QR code has expired. On your computer, close and reopen “Scan a QR” to show a fresh code, then scan it again.');
        }
      })
      .catch(() => { /* transient — allow the upload to surface any real error */ });
  }, [sessionId]);

  const onPick = (f) => {
    if (!f) return;
    if (!/^image\//i.test(f.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)) {
      setError('Please choose a photo of the invoice.');
      return;
    }
    setError('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setPhase('pick');
  };

  const upload = async () => {
    if (!file) return;
    setPhase('uploading');
    setError('');
    try {
      const toSend = await downscaleImage(file);
      await uploadCaptureImage(sessionId, toSend);
      setPhase('done');
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed. Please try again.');
      setPhase('pick');
    }
  };

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null); setPreviewUrl(''); setPhase('pick'); setError('');
  };

  const invalidSession = useMemo(() => !sessionId || sessionDead, [sessionId, sessionDead]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: colors.canvas, display: 'flex', flexDirection: 'column',
      alignItems: 'center', p: 2.5, gap: 2 }}>
      <Box sx={{ width: '100%', maxWidth: 460, textAlign: 'center', mt: 2 }}>
        <Typography sx={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
          Capture Invoice
        </Typography>
        <Typography sx={{ color: colors.textSecondary, mt: 0.5, fontSize: '0.9rem' }}>
          Take a clear photo of the invoice. It uploads to your inventory system for review.
        </Typography>
      </Box>

      {!sessionId && (
        <Alert severity="error" sx={{ width: '100%', maxWidth: 460 }}>
          This link is missing its session. Scan the QR code on your computer again.
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ width: '100%', maxWidth: 460 }} onClose={() => setError('')}>{error}</Alert>}

      {phase === 'done' ? (
        <Box sx={{ width: '100%', maxWidth: 460, textAlign: 'center', mt: 4, display: 'grid', placeItems: 'center', gap: 1.5 }}>
          <CheckCircle2 size={64} color={colors.success} />
          <Typography sx={{ fontSize: '1.1rem', fontWeight: 700 }}>Sent!</Typography>
          <Typography sx={{ color: colors.textSecondary }}>
            Go back to your computer to review the extracted items and confirm.
          </Typography>
          <Button sx={{ mt: 1 }} startIcon={<Camera size={18} />} onClick={retake}>Capture another</Button>
        </Box>
      ) : (
        <Box sx={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Native camera capture — works over HTTP on the LAN. */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => onPick(e.target.files?.[0])}
          />

          {previewUrl ? (
            <Box
              component="img"
              src={previewUrl}
              alt="Invoice"
              sx={{ width: '100%', borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', maxHeight: '58vh', objectFit: 'contain', bgcolor: '#fff' }}
            />
          ) : (
            <Box
              onClick={() => !invalidSession && fileRef.current?.click()}
              sx={{
                border: `2px dashed ${colors.borderStrong}`, borderRadius: 4, p: 5, textAlign: 'center',
                bgcolor: colors.paper, cursor: invalidSession ? 'not-allowed' : 'pointer', opacity: invalidSession ? 0.5 : 1,
              }}
            >
              <Camera size={52} color={colors.primary} />
              <Typography sx={{ fontWeight: 700, mt: 1.5, fontSize: '1.05rem' }}>Tap to open camera</Typography>
              <Typography sx={{ color: colors.textMuted, mt: 0.5, fontSize: '0.85rem' }}>or choose an existing photo</Typography>
            </Box>
          )}

          {previewUrl && phase !== 'uploading' && (
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button fullWidth variant="outlined" startIcon={<RefreshCw size={18} />} onClick={retake}>
                Retake
              </Button>
              <Button fullWidth variant="contained" startIcon={<Upload size={18} />} onClick={upload} disabled={invalidSession}>
                Upload
              </Button>
            </Box>
          )}

          {phase === 'uploading' && (
            <Button fullWidth variant="contained" disabled startIcon={<CircularProgress size={18} color="inherit" />}>
              Uploading & reading…
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
};

export default MobileCapturePage;
