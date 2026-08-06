import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  TextField, MenuItem, ListSubheader, IconButton, CircularProgress, Chip, Divider, Grid, Alert,
} from '@mui/material';
import { UploadCloud, FileText, X, Sparkles, RefreshCw, Check } from 'lucide-react';
import { extractInvoice, confirmInvoice } from '../../api/purchaseApi';
import { getEquipment } from '../../api/equipmentApi';
import { formatCurrency, CURRENCY_SYMBOL } from '../../utils/currency';
import { colors } from '../../theme/tokens';

const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
const isAllowed = (f) => /pdf|jpe?g|png/i.test(f.type) || /\.(pdf|jpe?g|png)$/i.test(f.name);

const norm = (s) => String(s || '').trim().toLowerCase();
const findMatch = (name, list, key) => {
  const n = norm(name);
  if (!n) return null;
  return list.find((x) => norm(x[key]) === n)
    || list.find((x) => norm(x[key]).includes(n) || n.includes(norm(x[key]))) || null;
};

// Encode/decode a line's resolution into a single Select value.
const encode = (l) => {
  if (l.resolution === 'SKIP') return 'skip';
  if (l.resolution === 'EXISTING_COMPONENT') return `comp:${l.componentId}`;
  if (l.resolution === 'NEW_COMPONENT') return 'newcomp';
  if (l.resolution === 'EXISTING_EQUIPMENT') return `equip:${l.equipmentId}`;
  if (l.resolution === 'NEW_EQUIPMENT') return 'newequip';
  return 'skip';
};
const decode = (v) => {
  if (v === 'skip') return { resolution: 'SKIP', componentId: null, equipmentId: null };
  if (v === 'newcomp') return { resolution: 'NEW_COMPONENT', componentId: null, equipmentId: null };
  if (v === 'newequip') return { resolution: 'NEW_EQUIPMENT', componentId: null, equipmentId: null };
  if (v.startsWith('comp:')) return { resolution: 'EXISTING_COMPONENT', componentId: Number(v.slice(5)), equipmentId: null };
  if (v.startsWith('equip:')) return { resolution: 'EXISTING_EQUIPMENT', equipmentId: Number(v.slice(6)), componentId: null };
  return { resolution: 'SKIP' };
};

const isComponentRes = (r) => r === 'EXISTING_COMPONENT' || r === 'NEW_COMPONENT';
const labelSx = { fontSize: '0.8125rem', fontWeight: 600, color: colors.textSecondary, mb: 0.5 };

const badgeFor = (l) => {
  if (l.resolution === 'SKIP') return { label: 'Skipped', fg: colors.textSecondary, bg: '#F2F1EE' };
  if (l.resolution === 'NEW_COMPONENT') return { label: 'New Component', fg: colors.warning, bg: colors.warningSoft };
  if (l.resolution === 'NEW_EQUIPMENT') return { label: 'New Equipment', fg: colors.warning, bg: colors.warningSoft };
  if (l.resolution === 'EXISTING_EQUIPMENT') return { label: 'Equipment', fg: colors.info, bg: colors.infoSoft };
  return { label: 'Matched', fg: colors.success, bg: colors.successSoft };
};

const InvoiceUploadDialog = ({ open, onClose, components, onCreated }) => {
  const fileRef = useRef(null);
  const [equipment, setEquipment] = useState([]);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isPdf, setIsPdf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [header, setHeader] = useState(null);
  const [lines, setLines] = useState([]);

  // Load equipment once when the dialog opens (for matching against assets).
  useEffect(() => {
    if (!open) return;
    getEquipment({ page: 0, size: 500, sortBy: 'name', sortDir: 'asc' })
      .then((r) => setEquipment(r.data?.content || []))
      .catch(() => setEquipment([]));
  }, [open]);

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null); setPreviewUrl(''); setIsPdf(false); setLoading(false);
    setError(''); setResult(null); setHeader(null); setLines([]);
  };
  const handleClose = () => { reset(); onClose(); };

  const handleFile = async (f) => {
    if (!f) return;
    if (!isAllowed(f)) { setError('Please upload a PDF, JPG, JPEG or PNG file.'); return; }
    setError('');
    const url = URL.createObjectURL(f);
    setFile(f); setPreviewUrl(url); setIsPdf(/pdf/i.test(f.type) || /\.pdf$/i.test(f.name));
    setLoading(true);
    try {
      const res = await extractInvoice(f);
      const d = res.data;
      setResult({ extractionId: d.extractionId, invoiceFilePath: d.invoiceFilePath, provider: d.provider, mock: d.mock });
      const ex = d.extracted || {};
      setHeader({
        supplierName: ex.supplierName || '', supplierAddress: ex.supplierAddress || '',
        gstNumber: ex.gstNumber || '', invoiceNumber: ex.invoiceNumber || '', invoiceDate: ex.invoiceDate || '',
        purchaseOrderNumber: ex.purchaseOrderNumber || '', placeOfSupply: ex.placeOfSupply || '',
        paymentTerms: ex.paymentTerms || '', currency: ex.currency || 'INR',
        subTotal: ex.subTotal ?? 0, taxAmount: ex.taxAmount ?? 0, shippingCharges: ex.shippingCharges ?? 0,
        grandTotal: ex.grandTotal ?? 0, finalInvoiceAmount: ex.finalInvoiceAmount ?? 0,
      });
      setLines((ex.items || []).map((it) => {
        const comp = findMatch(it.description, components, 'componentName');
        const equip = comp ? null : findMatch(it.description, equipment, 'name');
        let resolution; let componentId = null; let equipmentId = null;
        if (comp) { resolution = 'EXISTING_COMPONENT'; componentId = comp.id; }
        else if (equip) { resolution = 'EXISTING_EQUIPMENT'; equipmentId = equip.id; }
        else if (it.suggestedType === 'SERVICE') { resolution = 'SKIP'; }
        else if (it.suggestedType === 'EQUIPMENT') { resolution = 'NEW_EQUIPMENT'; }
        else { resolution = 'NEW_COMPONENT'; }
        return {
          description: it.description || '', supplierItemCode: it.supplierItemCode || '', hsnCode: it.hsnCode || '',
          category: it.category || '', unit: it.unit || 'pcs', suggestedType: it.suggestedType || 'COMPONENT',
          quantity: Number(it.quantity) || 0, unitPrice: Number(it.unitPrice) || 0,
          taxPercentage: Number(it.taxPercentage) || 0, lineTotal: Number(it.lineTotal) || 0,
          resolution, componentId, equipmentId,
        };
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not extract invoice data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const setLine = (i, patch) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const componentLines = lines.filter((l) => isComponentRes(l.resolution) && Number(l.quantity) > 0 && Number(l.unitPrice) > 0);
  const newCount = lines.filter((l) => l.resolution === 'NEW_COMPONENT' || l.resolution === 'NEW_EQUIPMENT').length;
  const equipCount = lines.filter((l) => l.resolution === 'EXISTING_EQUIPMENT' || l.resolution === 'NEW_EQUIPMENT').length;
  const skipCount = lines.filter((l) => l.resolution === 'SKIP').length;
  const canConfirm = header?.supplierName && header?.invoiceNumber && componentLines.length > 0 && !submitting;

  const handleConfirm = async () => {
    setSubmitting(true); setError('');
    try {
      const remarksBits = [
        header.purchaseOrderNumber && `PO: ${header.purchaseOrderNumber}`,
        header.paymentTerms && `Terms: ${header.paymentTerms}`,
        header.gstNumber && `GST: ${header.gstNumber}`,
      ].filter(Boolean);
      const payload = {
        extractionId: result?.extractionId,
        invoiceFilePath: result?.invoiceFilePath,
        supplierName: header.supplierName,
        invoiceNumber: header.invoiceNumber,
        purchaseDate: header.invoiceDate || null,
        remarks: remarksBits.join(' · ') || null,
        items: lines.map((l) => ({
          resolution: l.resolution,
          componentId: l.resolution === 'EXISTING_COMPONENT' ? Number(l.componentId) : null,
          equipmentId: l.resolution === 'EXISTING_EQUIPMENT' ? Number(l.equipmentId) : null,
          name: l.description, category: l.category, unit: l.unit,
          quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0,
        })),
      };
      await confirmInvoice(payload);
      const parts = [`${componentLines.length} component line(s)`];
      if (newCount) parts.push(`${newCount} new item(s) created`);
      if (equipCount) parts.push(`${equipCount} equipment`);
      onCreated?.(`Purchase created from invoice — ${parts.join(', ')}. Stock updated.`);
      handleClose();
    } catch (err) {
      // Backend is transactional: on failure nothing was created.
      setError(err.response?.data?.message || 'Could not create the purchase. No changes were made.');
    } finally {
      setSubmitting(false);
    }
  };

  const linesTotal = useMemo(
    () => componentLines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitPrice || 0), 0),
    [componentLines]
  );

  return (
    <Dialog open={open} onClose={submitting ? undefined : handleClose} maxWidth="lg" fullWidth
      PaperProps={{ sx: { height: { md: '92vh' }, maxHeight: '92vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Sparkles size={22} color={colors.primary} />
        <Box sx={{ flexGrow: 1 }}>
          Upload Invoice
          {result?.mock && (
            <Chip size="small" label="Sample data — OCR not yet connected"
              sx={{ ml: 1.5, bgcolor: colors.warningSoft, color: colors.warning, fontWeight: 600 }} />
          )}
        </Box>
        <IconButton onClick={handleClose} disabled={submitting}><X size={20} /></IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        {error && <Alert severity="error" sx={{ m: 2, mb: 0 }} onClose={() => setError('')}>{error}</Alert>}

        {!file ? (
          <Box sx={{ p: 4, display: 'grid', placeItems: 'center', minHeight: 320 }}>
            <Box
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
              sx={{
                width: '100%', maxWidth: 560, p: 6, textAlign: 'center', cursor: 'pointer',
                border: `2px dashed ${colors.borderStrong}`, borderRadius: 4, bgcolor: colors.canvas,
                transition: 'border-color .18s ease, background-color .18s ease',
                '&:hover': { borderColor: colors.primary, bgcolor: colors.primarySoft },
              }}
            >
              <UploadCloud size={44} color={colors.primary} />
              <Typography sx={{ fontSize: '1.125rem', fontWeight: 600, mt: 1.5 }}>Drop an invoice here, or click to browse</Typography>
              <Typography sx={{ color: colors.textMuted, mt: 0.5 }}>PDF, JPG, JPEG or PNG · up to 10&nbsp;MB</Typography>
            </Box>
            <input ref={fileRef} type="file" hidden accept={ACCEPT} onChange={(e) => handleFile(e.target.files?.[0])} />
          </Box>
        ) : (
          <Grid container sx={{ height: '100%' }}>
            {/* Invoice preview */}
            <Grid item xs={12} md={5} sx={{ borderRight: { md: `1px solid ${colors.border}` }, bgcolor: '#F4F3F1', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1 }}>
                <FileText size={17} color={colors.textSecondary} />
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, flexGrow: 1 }} noWrap>{file.name}</Typography>
                <Button size="small" startIcon={<RefreshCw size={15} />} onClick={reset}>Replace</Button>
              </Box>
              <Divider />
              <Box sx={{ flexGrow: 1, overflow: 'auto', p: 1.5, display: 'grid', placeItems: isPdf ? 'stretch' : 'center' }}>
                {loading ? (
                  <Box sx={{ display: 'grid', placeItems: 'center', gap: 1.5, alignSelf: 'center', justifySelf: 'center' }}>
                    <CircularProgress /><Typography sx={{ color: colors.textSecondary }}>Reading invoice…</Typography>
                  </Box>
                ) : isPdf ? (
                  <Box component="iframe" title="Invoice preview" src={previewUrl}
                    sx={{ width: '100%', height: '100%', minHeight: 420, border: 'none', borderRadius: 2, bgcolor: '#fff' }} />
                ) : (
                  <Box component="img" src={previewUrl} alt="Invoice preview"
                    sx={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 2, boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }} />
                )}
              </Box>
            </Grid>

            {/* Extracted + review */}
            <Grid item xs={12} md={7} sx={{ display: 'flex', flexDirection: 'column' }}>
              {loading || !header ? (
                <Box sx={{ flexGrow: 1, display: 'grid', placeItems: 'center', minHeight: 300 }}>
                  <Typography sx={{ color: colors.textMuted }}>{loading ? 'Extracting fields…' : ''}</Typography>
                </Box>
              ) : (
                <Box sx={{ p: 2.5, overflow: 'auto' }}>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, mb: 0.5 }}>Review Extracted Details</Typography>
                  <Typography sx={{ fontSize: '0.8125rem', color: colors.textMuted, mb: 2 }}>
                    Edit any field, then resolve each line to an existing item or create a new one. Nothing is created until you confirm.
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography sx={labelSx}>Supplier Name</Typography>
                      <TextField fullWidth size="small" value={header.supplierName} onChange={(e) => setHeader({ ...header, supplierName: e.target.value })} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography sx={labelSx}>Invoice Number</Typography>
                      <TextField fullWidth size="small" value={header.invoiceNumber} onChange={(e) => setHeader({ ...header, invoiceNumber: e.target.value })} />
                    </Grid>
                    <Grid item xs={6} sm={4}>
                      <Typography sx={labelSx}>Invoice Date</Typography>
                      <TextField fullWidth size="small" type="date" InputLabelProps={{ shrink: true }} value={header.invoiceDate} onChange={(e) => setHeader({ ...header, invoiceDate: e.target.value })} />
                    </Grid>
                    <Grid item xs={6} sm={4}>
                      <Typography sx={labelSx}>PO Number</Typography>
                      <TextField fullWidth size="small" value={header.purchaseOrderNumber} onChange={(e) => setHeader({ ...header, purchaseOrderNumber: e.target.value })} />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Typography sx={labelSx}>GST / VAT</Typography>
                      <TextField fullWidth size="small" value={header.gstNumber} onChange={(e) => setHeader({ ...header, gstNumber: e.target.value })} />
                    </Grid>
                    <Grid item xs={6} sm={4}>
                      <Typography sx={labelSx}>Place of Supply</Typography>
                      <TextField fullWidth size="small" value={header.placeOfSupply} onChange={(e) => setHeader({ ...header, placeOfSupply: e.target.value })} />
                    </Grid>
                    <Grid item xs={6} sm={4}>
                      <Typography sx={labelSx}>Payment Terms</Typography>
                      <TextField fullWidth size="small" value={header.paymentTerms} onChange={(e) => setHeader({ ...header, paymentTerms: e.target.value })} />
                    </Grid>
                  </Grid>

                  <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, mt: 3, mb: 1 }}>
                    Line Items · resolve each to a Component or Equipment
                  </Typography>

                  {lines.map((l, i) => {
                    const b = badgeFor(l);
                    const isComp = isComponentRes(l.resolution);
                    return (
                      <Box key={i} sx={{ p: 1.75, mb: 1.25, border: `1px solid ${colors.border}`, borderRadius: 2.5,
                        bgcolor: l.resolution === 'SKIP' ? colors.canvas : colors.paper, opacity: l.resolution === 'SKIP' ? 0.75 : 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, flexGrow: 1 }} noWrap>{l.description}</Typography>
                          <Chip size="small" label={b.label} sx={{ bgcolor: b.bg, color: b.fg, fontWeight: 600 }} />
                        </Box>
                        {(l.supplierItemCode || l.hsnCode) && (
                          <Typography sx={{ fontSize: '0.8125rem', color: colors.textMuted, mb: 1 }}>
                            {l.supplierItemCode ? `Code ${l.supplierItemCode}` : ''}{l.supplierItemCode && l.hsnCode ? ' · ' : ''}{l.hsnCode ? `HSN ${l.hsnCode}` : ''}
                            {l.taxPercentage ? ` · GST ${l.taxPercentage}%` : ''}
                          </Typography>
                        )}
                        <Grid container spacing={1.25} alignItems="center">
                          <Grid item xs={12} sm={5}>
                            <TextField select fullWidth size="small" label="Resolve to" value={encode(l)}
                              onChange={(e) => setLine(i, decode(e.target.value))}>
                              <MenuItem value="skip"><em>Skip this line</em></MenuItem>
                              <ListSubheader>Components</ListSubheader>
                              <MenuItem value="newcomp">➕ Create as new component</MenuItem>
                              {components.map((c) => (
                                <MenuItem key={`c${c.id}`} value={`comp:${c.id}`}>{c.itemCode ? `${c.itemCode} · ` : ''}{c.componentName}</MenuItem>
                              ))}
                              <ListSubheader>Equipment</ListSubheader>
                              <MenuItem value="newequip">➕ Register as new equipment</MenuItem>
                              {equipment.map((eq) => (
                                <MenuItem key={`e${eq.id}`} value={`equip:${eq.id}`}>{eq.itemCode ? `${eq.itemCode} · ` : ''}{eq.name}</MenuItem>
                              ))}
                            </TextField>
                          </Grid>
                          <Grid item xs={4} sm={2}>
                            <TextField fullWidth size="small" label="Qty" type="number" value={l.quantity}
                              onChange={(e) => setLine(i, { quantity: e.target.value })} disabled={!isComp} />
                          </Grid>
                          <Grid item xs={4} sm={2.5}>
                            <TextField fullWidth size="small" label={`Unit Price (${CURRENCY_SYMBOL})`} type="number" value={l.unitPrice}
                              onChange={(e) => setLine(i, { unitPrice: e.target.value })} disabled={!isComp} />
                          </Grid>
                          <Grid item xs={4} sm={2.5}>
                            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, textAlign: 'right', color: isComp ? colors.textPrimary : colors.textMuted }}>
                              {isComp ? formatCurrency(Number(l.quantity || 0) * Number(l.unitPrice || 0)) : '—'}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Box>
                    );
                  })}

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 1, mt: 1.5, pt: 1.5, borderTop: `1px solid ${colors.border}` }}>
                    <Typography sx={{ fontSize: '0.875rem', color: colors.textMuted }}>
                      {componentLines.length} stock line(s){newCount ? ` · ${newCount} new` : ''}{equipCount ? ` · ${equipCount} equipment` : ''}{skipCount ? ` · ${skipCount} skipped` : ''}
                    </Typography>
                    <Typography sx={{ fontSize: '1.0625rem', fontWeight: 700 }}>Stock total {formatCurrency(linesTotal)}</Typography>
                  </Box>
                </Box>
              )}
            </Grid>
          </Grid>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="text" onClick={handleClose} disabled={submitting}>Cancel</Button>
        <Button variant="contained" onClick={handleConfirm} disabled={!canConfirm}
          startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <Check size={18} />}>
          {submitting ? 'Creating…' : 'Confirm Purchase'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InvoiceUploadDialog;
