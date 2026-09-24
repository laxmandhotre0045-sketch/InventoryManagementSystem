import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Button, Typography, CircularProgress, Alert, Fade } from '@mui/material';
import { Camera, Upload, CheckCircle2, RefreshCw, Images, Sun, Crop, Smartphone } from 'lucide-react';
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

// The phone's own viewport height. 100vh is wrong on mobile browsers — it counts
// the space behind the retracting address bar, so a bottom bar sits off-screen.
const FULL_HEIGHT = '100dvh';
// Respect the notch and the home indicator rather than tucking controls under them.
const SAFE_TOP = 'env(safe-area-inset-top, 0px)';
const SAFE_BOTTOM = 'env(safe-area-inset-bottom, 0px)';

// Comfortable thumb target. Anything smaller is a miss on a phone held one-handed.
const TAP_HEIGHT = 52;

const SHOT_TIPS = [
  { icon: Crop, text: 'Fit all four corners in the frame' },
  { icon: Sun, text: 'Bright, even light — avoid shadow across the page' },
  { icon: Smartphone, text: 'Hold straight above, flatten any folds' },
];

/**
 * Phone-facing page opened by scanning the desktop's QR code. It is public (no
 * login) — the session id in the URL is the capability.
 *
 * Laid out for a phone held in one hand: the photo fills the screen and the
 * actions sit in a fixed bar at the bottom, within thumb reach, rather than
 * flowing off the end of a scrolling page.
 *
 * Uses a file input with capture="environment" rather than getUserMedia, because
 * the app may be served over plain HTTP on the LAN, where getUserMedia is blocked
 * but the native camera file-picker still works.
 */
const MobileCapturePage = () => {
  const [params] = useSearchParams();
  const sessionId = params.get('s') || params.get('session') || '';
  const fileRef = useRef(null);
  const galleryRef = useRef(null);

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

  // Release the object URL when the component goes away.
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

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
      // The server distinguishes "unreadable photo" from "not an invoice"; both
      // messages are written for the person holding the phone, so show them as-is.
      setError(err.response?.data?.message || 'Upload failed. Please check your connection and try again.');
      setPhase('pick');
    }
  };

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null); setPreviewUrl(''); setPhase('pick'); setError('');
  };

  const invalidSession = useMemo(() => !sessionId || sessionDead, [sessionId, sessionDead]);
  const busy = phase === 'uploading';

  // ---------------------------------------------------------------- success
  if (phase === 'done') {
    return (
      <Box sx={{ minHeight: FULL_HEIGHT, bgcolor: colors.canvas, display: 'grid', placeItems: 'center',
        px: 3, pt: `calc(${SAFE_TOP} + 24px)`, pb: `calc(${SAFE_BOTTOM} + 24px)` }}>
        <Fade in>
          <Box sx={{ textAlign: 'center', maxWidth: 420 }}>
            <Box sx={{ width: 96, height: 96, borderRadius: '50%', bgcolor: colors.successSoft,
              display: 'grid', placeItems: 'center', mx: 'auto', mb: 2.5 }}>
              <CheckCircle2 size={52} color={colors.success} />
            </Box>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Sent to your computer
            </Typography>
            <Typography sx={{ color: colors.textSecondary, mt: 1, fontSize: '1rem', lineHeight: 1.5 }}>
              The invoice is open for review on the desktop. Check the items there and confirm
              the purchase.
            </Typography>
            <Typography sx={{ color: colors.textMuted, mt: 2, fontSize: '0.85rem' }}>
              You can close this tab.
            </Typography>
            <Button
              onClick={retake}
              startIcon={<Camera size={18} />}
              sx={{ mt: 3, height: TAP_HEIGHT, px: 3, borderRadius: 99, fontWeight: 700 }}
            >
              Capture another
            </Button>
          </Box>
        </Fade>
      </Box>
    );
  }

  // ---------------------------------------------------------------- capture
  return (
    <Box sx={{ minHeight: FULL_HEIGHT, bgcolor: colors.canvas, display: 'flex', flexDirection: 'column' }}>
      {/* Header — compact, so the photo gets the screen. */}
      <Box sx={{ px: 2.5, pt: `calc(${SAFE_TOP} + 20px)`, pb: 1.5, textAlign: 'center' }}>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Camera size={20} color={colors.primary} />
          <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Capture Invoice
          </Typography>
        </Box>
        <Typography sx={{ color: colors.textSecondary, fontSize: '0.9rem', lineHeight: 1.45 }}>
          {previewUrl
            ? 'Check the whole invoice is readable, then send it.'
            : 'Take a photo — it opens on your computer for review.'}
        </Typography>
      </Box>

      {!sessionId && (
        <Alert severity="error" sx={{ mx: 2, borderRadius: 2.5 }}>
          This link is missing its session. Scan the QR code on your computer again.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mx: 2, borderRadius: 2.5 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Body — the photo, or the invitation to take one. */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        px: 2, py: 2, minHeight: 0 }}>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
          onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ''; }} />
        <input ref={galleryRef} type="file" accept="image/*" hidden
          onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ''; }} />

        {previewUrl ? (
          <Box component="img" src={previewUrl} alt="The invoice you photographed"
            sx={{ width: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 3,
              bgcolor: '#fff', boxShadow: '0 6px 28px rgba(0,0,0,0.16)' }} />
        ) : (
          <>
            <Box
              role="button"
              tabIndex={invalidSession ? -1 : 0}
              onClick={() => !invalidSession && fileRef.current?.click()}
              onKeyDown={(e) => { if (!invalidSession && (e.key === 'Enter' || e.key === ' ')) fileRef.current?.click(); }}
              sx={{
                border: `2px dashed ${colors.borderStrong}`, borderRadius: 4, py: 6, px: 3,
                textAlign: 'center', bgcolor: colors.paper,
                cursor: invalidSession ? 'not-allowed' : 'pointer',
                opacity: invalidSession ? 0.5 : 1,
                // A clear press response matters more on touch than hover ever did.
                transition: 'transform .12s ease, background-color .12s ease',
                '&:active': invalidSession ? {} : { transform: 'scale(0.985)', bgcolor: colors.primarySoft },
              }}
            >
              <Box sx={{ width: 84, height: 84, borderRadius: '50%', bgcolor: colors.primarySoft,
                display: 'grid', placeItems: 'center', mx: 'auto', mb: 2 }}>
                <Camera size={40} color={colors.primary} />
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>Tap to open the camera</Typography>
              <Typography sx={{ color: colors.textMuted, mt: 0.5, fontSize: '0.875rem' }}>
                Point at the invoice and take the shot
              </Typography>
            </Box>

            <Box sx={{ mt: 3, px: 0.5 }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: colors.textMuted,
                letterSpacing: '0.06em', textTransform: 'uppercase', mb: 1.25 }}>
                For an accurate read
              </Typography>
              {SHOT_TIPS.map(({ icon: Icon, text }) => (
                <Box key={text} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
                  <Icon size={16} color={colors.textSecondary} style={{ flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.875rem', color: colors.textSecondary, lineHeight: 1.4 }}>
                    {text}
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        )}
      </Box>

      {/* Action bar — pinned to the bottom, where the thumb already is. */}
      <Box sx={{
        position: 'sticky', bottom: 0, bgcolor: colors.paper,
        borderTop: `1px solid ${colors.border}`,
        px: 2, pt: 1.75, pb: `calc(${SAFE_BOTTOM} + 14px)`,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
      }}>
        {busy ? (
          <Button fullWidth variant="contained" disabled
            startIcon={<CircularProgress size={18} color="inherit" />}
            sx={{ height: TAP_HEIGHT, borderRadius: 3, fontWeight: 700, fontSize: '1rem' }}>
            Sending & reading…
          </Button>
        ) : previewUrl ? (
          <Box sx={{ display: 'flex', gap: 1.25 }}>
            <Button variant="outlined" onClick={retake} startIcon={<RefreshCw size={18} />}
              sx={{ height: TAP_HEIGHT, borderRadius: 3, fontWeight: 700, flex: '0 0 40%' }}>
              Retake
            </Button>
            <Button variant="contained" onClick={upload} disabled={invalidSession}
              startIcon={<Upload size={18} />}
              sx={{ height: TAP_HEIGHT, borderRadius: 3, fontWeight: 700, fontSize: '1rem', flexGrow: 1 }}>
              Send
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 1.25 }}>
            <Button variant="contained" onClick={() => fileRef.current?.click()} disabled={invalidSession}
              startIcon={<Camera size={19} />}
              sx={{ height: TAP_HEIGHT, borderRadius: 3, fontWeight: 700, fontSize: '1rem', flexGrow: 1 }}>
              Take photo
            </Button>
            <Button variant="outlined" onClick={() => galleryRef.current?.click()} disabled={invalidSession}
              aria-label="Choose an existing photo"
              sx={{ height: TAP_HEIGHT, minWidth: TAP_HEIGHT, borderRadius: 3, px: 0 }}>
              <Images size={20} />
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default MobileCapturePage;
