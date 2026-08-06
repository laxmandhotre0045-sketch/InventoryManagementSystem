import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography,
  IconButton, Button, CircularProgress, Tooltip, Chip,
} from '@mui/material';
import {
  X, Download, ZoomIn, ZoomOut, RotateCw, Maximize2, FileText, AlertTriangle,
} from 'lucide-react';
import { fetchInvoiceBlob, downloadInvoice } from '../../api/purchaseApi';
import { colors } from '../../theme/tokens';

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;

const dateTime = (v) =>
  (v ? new Date(v).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

/**
 * Views a stored invoice.
 *
 * The document is fetched as a blob through the authenticated API rather than
 * pointed at by URL, because the endpoint requires a bearer token that the
 * browser would not attach to a plain <iframe src>.
 *
 * PDFs render in the browser's built-in viewer, which brings its own zoom, so the
 * custom zoom controls are shown only for images — offering them for a PDF would
 * be a control that does nothing.
 */
const InvoiceViewerDialog = ({ open, purchase, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [src, setSrc] = useState('');
  const [contentType, setContentType] = useState('');
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const objectUrlRef = useRef('');

  const isPdf = contentType.includes('pdf');
  const isImage = contentType.startsWith('image/');

  const release = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = '';
    }
  }, []);

  useEffect(() => {
    if (!open || !purchase?.id) return undefined;
    let cancelled = false;

    setLoading(true);
    setError('');
    setZoom(1);
    setRotation(0);

    fetchInvoiceBlob(purchase.id)
      .then(({ url, contentType: type }) => {
        if (cancelled) { URL.revokeObjectURL(url); return; }
        release();
        objectUrlRef.current = url;
        setSrc(url);
        setContentType(type);
      })
      .catch(async (err) => {
        if (cancelled) return;
        // An error response for a blob request arrives as a Blob, so the JSON
        // message has to be read out of it rather than off err.response.data.
        let message = 'Could not load this invoice.';
        const data = err.response?.data;
        if (data instanceof Blob) {
          try {
            const parsed = JSON.parse(await data.text());
            if (parsed?.message) message = parsed.message;
          } catch { /* keep the default */ }
        } else if (data?.message) {
          message = data.message;
        }
        setError(message);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [open, purchase?.id, release]);

  // Free the object URL when the dialog closes or the component unmounts.
  useEffect(() => {
    if (!open) { release(); setSrc(''); setContentType(''); }
  }, [open, release]);
  useEffect(() => release, [release]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadInvoice(purchase.id, purchase.invoiceFileOriginalName);
    } catch {
      setError('Could not download this invoice.');
    } finally {
      setDownloading(false);
    }
  };

  const openInNewTab = () => { if (src) window.open(src, '_blank', 'noopener'); };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth
      PaperProps={{ sx: { height: { sm: '90vh' }, maxHeight: '90vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, pb: 1.25 }}>
        <FileText size={18} color={colors.primary} />
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 650 }} noWrap>
            Invoice {purchase?.invoiceNumber}
          </Typography>
          <Typography sx={{ fontSize: '0.6875rem', color: colors.textMuted, fontWeight: 400 }} noWrap>
            {purchase?.supplierName || 'Unknown supplier'}
            {purchase?.invoiceFileOriginalName ? ` · ${purchase.invoiceFileOriginalName}` : ''}
            {purchase?.invoiceUploadedAt ? ` · uploaded ${dateTime(purchase.invoiceUploadedAt)}` : ''}
            {purchase?.invoiceUploadedBy ? ` by ${purchase.invoiceUploadedBy}` : ''}
          </Typography>
        </Box>

        {isImage && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
            <Tooltip title="Zoom out">
              <span>
                <IconButton size="small" disabled={zoom <= ZOOM_MIN} onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}>
                  <ZoomOut size={16} />
                </IconButton>
              </span>
            </Tooltip>
            <Chip size="small" label={`${Math.round(zoom * 100)}%`} onClick={() => setZoom(1)} sx={{ minWidth: 46, cursor: 'pointer' }} />
            <Tooltip title="Zoom in">
              <span>
                <IconButton size="small" disabled={zoom >= ZOOM_MAX} onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}>
                  <ZoomIn size={16} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Rotate">
              <IconButton size="small" onClick={() => setRotation((r) => (r + 90) % 360)}><RotateCw size={16} /></IconButton>
            </Tooltip>
          </Box>
        )}

        <Tooltip title="Open in a new tab">
          <span>
            <IconButton size="small" onClick={openInNewTab} disabled={!src}><Maximize2 size={16} /></IconButton>
          </span>
        </Tooltip>
        <IconButton size="small" onClick={onClose} aria-label="Close invoice viewer"><X size={17} /></IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0, bgcolor: '#F4F3F1', display: 'flex' }}>
        {loading ? (
          <Box sx={{ m: 'auto', display: 'grid', placeItems: 'center', gap: 1.25 }}>
            <CircularProgress size={26} />
            <Typography sx={{ fontSize: '0.8125rem', color: colors.textSecondary }}>Loading invoice…</Typography>
          </Box>
        ) : error ? (
          <Box sx={{ m: 'auto', textAlign: 'center', px: 3 }}>
            <Box sx={{ width: 44, height: 44, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: colors.dangerSoft, color: colors.danger, mx: 'auto', mb: 1.5 }}>
              <AlertTriangle size={21} />
            </Box>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 0.5 }}>Invoice unavailable</Typography>
            <Typography sx={{ fontSize: '0.8125rem', color: colors.textSecondary, maxWidth: 380 }}>{error}</Typography>
          </Box>
        ) : isPdf ? (
          <Box component="iframe" title={`Invoice ${purchase?.invoiceNumber}`} src={src}
            sx={{ width: '100%', height: '100%', border: 'none', bgcolor: '#fff' }} />
        ) : isImage ? (
          <Box sx={{ width: '100%', height: '100%', overflow: 'auto', display: 'grid', placeItems: zoom > 1 ? 'start' : 'center', p: 2 }}>
            <Box
              component="img"
              src={src}
              alt={`Invoice ${purchase?.invoiceNumber}`}
              sx={{
                display: 'block',
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'top left',
                transition: 'transform .18s ease',
                maxWidth: zoom === 1 ? '100%' : 'none',
                maxHeight: zoom === 1 ? '100%' : 'none',
                boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
                bgcolor: '#fff',
              }}
            />
          </Box>
        ) : (
          <Box sx={{ m: 'auto', textAlign: 'center', px: 3 }}>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 0.5 }}>Preview not supported</Typography>
            <Typography sx={{ fontSize: '0.8125rem', color: colors.textSecondary }}>
              This file type can&apos;t be shown in the browser. Download it to open locally.
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.5 }}>
        <Button variant="text" onClick={onClose}>Close</Button>
        <Button variant="contained" startIcon={<Download size={15} />} onClick={handleDownload} disabled={downloading || !!error}>
          {downloading ? 'Downloading…' : 'Download'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InvoiceViewerDialog;
