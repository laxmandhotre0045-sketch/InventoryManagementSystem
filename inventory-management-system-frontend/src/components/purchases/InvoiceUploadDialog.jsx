import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  TextField, MenuItem, ListSubheader, IconButton, CircularProgress, Chip, Divider, Grid, Alert,
} from '@mui/material';
import { UploadCloud, FileText, X, Sparkles, RefreshCw, Check, Smartphone, FolderInput } from 'lucide-react';
import { extractInvoice, confirmInvoice, fetchExtractionBlob } from '../../api/purchaseApi';
import { getProjects } from '../../api/projectApi';
import { getEquipment } from '../../api/equipmentApi';
import { getComponentCategories } from '../../api/componentCategoryApi';
import PhoneScanDialog from './PhoneScanDialog';
import InventoryPathEditor from './InventoryPathEditor';
import { formatCurrency, CURRENCY_SYMBOL } from '../../utils/currency';
import { colors } from '../../theme/tokens';

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.csv,.txt,application/pdf,image/jpeg,image/png,text/csv';
const isAllowed = (f) => /pdf|jpe?g|png|csv|text/i.test(f.type) || /\.(pdf|jpe?g|png|csv|txt)$/i.test(f.name);
const isCsvFile = (f) => /csv|text\/plain|excel/i.test(f.type) || /\.(csv|txt)$/i.test(f.name);

// Shrink large photos before extraction so the AI vision call is fast and doesn't
// time out. Only touches images; PDFs/CSVs pass through untouched.
const downscaleImage = async (file, maxDim = 2000, quality = 0.92) => {
  try {
    if (!/^image\//i.test(file.type)) return file;
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxDim / longest);
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
    return file;
  }
};

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
const isEquipmentRes = (r) => r === 'EXISTING_EQUIPMENT' || r === 'NEW_EQUIPMENT';
// Anything that isn't skipped creates something on confirm. Equipment is registered
// as an asset rather than stocked, but it is still a real outcome — an invoice for a
// single instrument has no component lines at all and must still be confirmable.
const isActionableRes = (r) => isComponentRes(r) || isEquipmentRes(r);
const labelSx = { fontSize: '0.8125rem', fontWeight: 600, color: colors.textSecondary, mb: 0.5 };

const TotalRow = ({ label, value, strong }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2, py: 0.25 }}>
    <Typography sx={{ fontSize: strong ? '0.875rem' : '0.8125rem', fontWeight: strong ? 700 : 500,
      color: strong ? colors.textPrimary : colors.textSecondary }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: strong ? '0.9375rem' : '0.8125rem', fontWeight: strong ? 700 : 500,
      fontVariantNumeric: 'tabular-nums' }}>
      {formatCurrency(value)}
    </Typography>
  </Box>
);

const badgeFor = (l) => {
  if (l.resolution === 'SKIP') return { label: 'Skipped', fg: colors.textSecondary, bg: '#F2F1EE' };
  if (l.resolution === 'NEW_COMPONENT') return { label: 'New Component', fg: colors.warning, bg: colors.warningSoft };
  if (l.resolution === 'NEW_EQUIPMENT') return { label: 'New Equipment', fg: colors.warning, bg: colors.warningSoft };
  if (l.resolution === 'EXISTING_EQUIPMENT') return { label: 'Equipment', fg: colors.info, bg: colors.infoSoft };
  return { label: 'Matched', fg: colors.success, bg: colors.successSoft };
};

/**
 * projectId / projectName (optional): scanning from inside a project — the purchase is
 * recorded for that project and every component line goes into its folder, unless the
 * line is sent to another project's folder (or kept in general stock) on the review.
 */
const InvoiceUploadDialog = ({ open, onClose, components, onCreated, projectId, projectName }) => {
  const fileRef = useRef(null);
  const [equipment, setEquipment] = useState([]);
  const [categories, setCategories] = useState([]);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isPdf, setIsPdf] = useState(false);
  const [isCsv, setIsCsv] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [header, setHeader] = useState(null);
  const [lines, setLines] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [phoneScanOpen, setPhoneScanOpen] = useState(false);
  const [capturedOnPhone, setCapturedOnPhone] = useState(false);
  // Other projects a component line can be sent to (only when scanning inside a project).
  const [otherProjects, setOtherProjects] = useState([]);

  // Load equipment once when the dialog opens (for matching against assets).
  useEffect(() => {
    if (!open) return;
    getEquipment({ page: 0, size: 500, sortBy: 'name', sortDir: 'asc' })
      .then((r) => setEquipment(r.data?.content || []))
      .catch(() => setEquipment([]));
    // Categories for the "where will this be filed" editor on new components.
    getComponentCategories()
      .then((r) => setCategories(r.data || []))
      .catch(() => setCategories([]));
    if (projectId) {
      getProjects({ page: 0, size: 200, sortBy: 'projectName', sortDir: 'asc' })
        .then((r) => setOtherProjects((r.data?.content || []).filter((p) => p.id !== Number(projectId))))
        .catch(() => setOtherProjects([]));
    }
  }, [open, projectId]);

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null); setPreviewUrl(''); setIsPdf(false); setIsCsv(false); setLoading(false);
    setError(''); setResult(null); setHeader(null); setLines([]); setWarnings([]); setCapturedOnPhone(false);
  };
  const handleClose = () => { reset(); onClose(); };

  const handleFile = async (f) => {
    if (!f) return;
    if (!isAllowed(f)) { setError('Please upload a PDF, image (JPG/PNG) or CSV file.'); return; }
    setError('');
    const url = URL.createObjectURL(f);
    const csv = isCsvFile(f);
    setFile(f); setPreviewUrl(url); setIsCsv(csv);
    setIsPdf(/pdf/i.test(f.type) || /\.pdf$/i.test(f.name));
    setLoading(true);
    try {
      const toExtract = await downscaleImage(f);
      const res = await extractInvoice(toExtract);
      populateFromResponse(res.data);
    } catch (err) {
      // A rejected file (not an invoice, unreadable) must leave nothing behind to
      // review or confirm — drop back to the drop zone carrying only the reason.
      const message = err.response?.data?.message || 'Could not extract invoice data. Please try again.';
      URL.revokeObjectURL(url);
      reset();
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Populate the editable review from an extraction response — shared by the file
  // upload path and the phone-capture path (which already ran extraction server-side).
  const populateFromResponse = (d) => {
    const ex = d.extracted || {};
    // A file with no line items and no invoice identity isn't an invoice. The server
    // rejects these outright; this catches the same case on the phone-capture path,
    // and refuses to populate a review the operator could confirm into real stock.
    const itemCount = (ex.items || []).length;
    if (!d.mock && itemCount === 0 && !ex.supplierName && !ex.invoiceNumber) {
      reset();
      setError('No invoice data was found in this file — it doesn’t look like an invoice. Please upload a clear photo or PDF of an actual invoice.');
      return;
    }
    setResult({ extractionId: d.extractionId, invoiceFilePath: d.invoiceFilePath, provider: d.provider, mock: d.mock });
    setWarnings(d.warnings || []);
    setHeader({
      supplierName: ex.supplierName || '', supplierAddress: ex.supplierAddress || '',
      gstNumber: ex.gstNumber || '', invoiceNumber: ex.invoiceNumber || '', invoiceDate: ex.invoiceDate || '',
      purchaseOrderNumber: ex.purchaseOrderNumber || '', placeOfSupply: ex.placeOfSupply || '',
      paymentTerms: ex.paymentTerms || '', currency: ex.currency || 'INR',
      subTotal: ex.subTotal ?? 0, taxAmount: ex.taxAmount ?? 0, shippingCharges: ex.shippingCharges ?? 0,
      discountTotal: ex.discountTotal ?? 0, otherCharges: ex.otherCharges ?? 0,
      grandTotal: ex.grandTotal ?? 0, finalInvoiceAmount: ex.finalInvoiceAmount ?? 0,
    });
    setLines((ex.items || []).map((it) => {
      // Same part already in stock? The server compares kind, value, package, voltage and
      // part numbers. Only a SURE match is pre-selected (confirming adds to that component's
      // quantity); a POSSIBLE one is offered below the line for the user to accept.
      const serverMatch = it.matchedComponentId != null
        && components.some((c) => c.id === it.matchedComponentId);
      const sure = serverMatch && it.matchConfidence === 'SURE';
      // Fallback: the exact same name. (Not "one name contains the other" — a stock item
      // called "OLED" would otherwise grab any line that merely mentions an OLED.)
      const sameName = sure ? null
        : components.find((c) => norm(c.componentName) === norm(it.description)) || null;
      const equip = (sure || sameName) ? null : findMatch(it.description, equipment, 'name');
      let resolution; let componentId = null; let equipmentId = null;
      if (sure) { resolution = 'EXISTING_COMPONENT'; componentId = it.matchedComponentId; }
      else if (sameName) { resolution = 'EXISTING_COMPONENT'; componentId = sameName.id; }
      else if (equip) { resolution = 'EXISTING_EQUIPMENT'; equipmentId = equip.id; }
      else if (it.suggestedType === 'SERVICE') { resolution = 'SKIP'; }
      else if (it.suggestedType === 'EQUIPMENT') { resolution = 'NEW_EQUIPMENT'; }
      else { resolution = 'NEW_COMPONENT'; }
      return {
        description: it.description || '', supplierItemCode: it.supplierItemCode || '', hsnCode: it.hsnCode || '',
        packageName: it.packageName || '',
        category: it.category || '', unit: it.unit || 'pcs', suggestedType: it.suggestedType || 'COMPONENT',
        quantity: Number(it.quantity) || 0, unitPrice: Number(it.unitPrice) || 0,
        discount: Number(it.discount) || 0, taxAmount: Number(it.taxAmount) || 0,
        taxPercentage: Number(it.taxPercentage) || 0, lineTotal: Number(it.lineTotal) || 0,
        resolution, componentId, equipmentId,
        // Project folder for a component line: 'here' (the project scanned in), 'p:<id>' or 'none'.
        folder: 'here',
        // Auto-suggested inventory path (Category › Type › Value) — editable before confirm.
        invCategory: it.inventoryCategory || it.category || '',
        invType: it.inventoryType || '',
        invValue: it.inventoryValue || '',
        invReason: it.inventoryReason || '',
        match: serverMatch ? {
          id: it.matchedComponentId, name: it.matchedComponentName, stock: it.matchedComponentStock ?? 0,
          confidence: it.matchConfidence, note: it.matchNote || '',
        } : null,
      };
    }));
  };

  // The phone finished capturing + extracting: open the review with its data,
  // and pull the stored photo back so it shows in the preview pane on the laptop.
  const handlePhoneResult = async (d) => {
    setPhoneScanOpen(false);
    setCapturedOnPhone(true);
    setError('');
    populateFromResponse(d);
    if (d?.extractionId) {
      try {
        const { url, contentType } = await fetchExtractionBlob(d.extractionId);
        setPreviewUrl(url);
        setIsPdf(/pdf/i.test(contentType));
        setIsCsv(/csv|text/i.test(contentType));
      } catch { /* preview is best-effort; the review still works without it */ }
    }
  };

  const setLine = (i, patch) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const componentLines = lines.filter((l) => isComponentRes(l.resolution) && Number(l.quantity) > 0 && Number(l.unitPrice) > 0);
  const newCount = lines.filter((l) => l.resolution === 'NEW_COMPONENT' || l.resolution === 'NEW_EQUIPMENT').length;
  const equipCount = lines.filter((l) => l.resolution === 'EXISTING_EQUIPMENT' || l.resolution === 'NEW_EQUIPMENT').length;
  const skipCount = lines.filter((l) => l.resolution === 'SKIP').length;
  const actionableLines = lines.filter((l) => isActionableRes(l.resolution));
  const canConfirm = header?.supplierName && header?.invoiceNumber && actionableLines.length > 0 && !submitting;

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
        projectId: projectId || null,
        supplierName: header.supplierName,
        invoiceNumber: header.invoiceNumber,
        purchaseDate: header.invoiceDate || null,
        remarks: remarksBits.join(' · ') || null,
        items: lines.map((l) => ({
          resolution: l.resolution,
          componentId: l.resolution === 'EXISTING_COMPONENT' ? Number(l.componentId) : null,
          equipmentId: l.resolution === 'EXISTING_EQUIPMENT' ? Number(l.equipmentId) : null,
          name: l.description,
          // New items are filed where the user confirmed; existing ones keep their place.
          category: (l.resolution === 'NEW_COMPONENT' || l.resolution === 'NEW_EQUIPMENT')
            ? (l.invCategory || l.category) : l.category,
          type: l.resolution === 'NEW_COMPONENT' ? (l.invType || null) : null,
          value: l.resolution === 'NEW_COMPONENT' ? (l.invValue || null) : null,
          // Saved as specifications of a newly created item; ignored for existing ones.
          supplierItemCode: l.supplierItemCode || null,
          hsnCode: l.hsnCode || null,
          packageName: l.packageName || null,
          unit: l.unit,
          quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0,
          // Which project folder the line goes into; absent = the project scanned in.
          projectId: l.folder?.startsWith('p:') ? Number(l.folder.slice(2)) : null,
          generalStock: l.folder === 'none' ? true : null,
        })),
      };
      await confirmInvoice(payload);
      const parts = [];
      if (componentLines.length) parts.push(`${componentLines.length} component line(s)`);
      if (equipCount) parts.push(`${equipCount} equipment registered`);
      if (newCount) parts.push(`${newCount} new item(s) created`);
      // Component lines from an invoice scanned inside a project go into that project's
      // folder, or the folder chosen for the line; equipment is not filed there.
      const inFolders = folderSummary.filter((f) => f.f !== 'none');
      const kept = folderSummary.find((f) => f.f === 'none');
      const toProject = projectId && componentLines.length
        ? (inFolders.length ? ` Added to ${inFolders.map((f) => `${f.name} (${f.count})`).join(', ')}.` : '')
          + (kept ? ` ${kept.count} kept in general stock only.` : '')
        : '';
      onCreated?.(`Purchase created from invoice — ${parts.join(', ')}.`
        + (componentLines.length ? ' Stock updated.' : '') + toProject);
      handleClose();
    } catch (err) {
      // Backend is transactional: on failure nothing was created.
      setError(err.response?.data?.message || 'Could not create the purchase. No changes were made.');
    } finally {
      setSubmitting(false);
    }
  };

  const folderName = (f) => {
    if (f === 'none') return 'General stock';
    if (f?.startsWith('p:')) return otherProjects.find((p) => p.id === Number(f.slice(2)))?.projectName || 'Another project';
    return projectName || 'This project';
  };
  // Where the component lines go, e.g. Solar (5), Sentrac_TMS (2), General stock (1).
  const folderSummary = useMemo(() => {
    const counts = new Map();
    componentLines.forEach((l) => counts.set(l.folder || 'here', (counts.get(l.folder || 'here') || 0) + 1));
    // This project first, then the others, general stock last.
    const rank = (f) => (f === 'here' ? 0 : f === 'none' ? 2 : 1);
    return [...counts].map(([f, count]) => ({ f, name: folderName(f), count }))
      .sort((a, b) => rank(a.f) - rank(b.f));
  }, [componentLines, otherProjects, projectName]); // eslint-disable-line react-hooks/exhaustive-deps

  const linesTotal = useMemo(
    () => componentLines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitPrice || 0), 0),
    [componentLines]
  );

  // What the reviewed lines add up to, against what the invoice says it totals.
  // These must agree before the purchase is worth confirming: a decimal point read
  // one place out is invisible on the line but shows up here immediately.
  const totals = useMemo(() => {
    if (!header) return null;
    const net = lines.reduce(
      (s, l) => s + Number(l.quantity || 0) * Number(l.unitPrice || 0) - Number(l.discount || 0), 0);
    const lineTax = lines.reduce((s, l) => s + Number(l.taxAmount || 0), 0);
    const tax = Number(header.taxAmount) || lineTax;
    // A charge the invoice also lists as a line ("Shipping Charge - Porter") is already in
    // the lines' sum; adding it again overstated the total by exactly that charge.
    const listedAsLine = (charge) => lines.some(
      (l) => Math.abs(Number(l.quantity || 0) * Number(l.unitPrice || 0) - Number(l.discount || 0) - charge) <= 0.05);
    const shippingRaw = Number(header.shippingCharges) || 0;
    const otherRaw = Number(header.otherCharges) || 0;
    const shipping = shippingRaw && !listedAsLine(shippingRaw) ? shippingRaw : 0;
    const other = otherRaw && !listedAsLine(otherRaw) ? otherRaw : 0;
    // An invoice-level discount only counts when the lines didn't already carry it.
    const discount = lines.some((l) => Number(l.discount)) ? 0 : Number(header.discountTotal) || 0;
    const computed = net + tax + shipping + other - discount;
    const printed = Number(header.grandTotal) || Number(header.finalInvoiceAmount) || 0;
    const difference = computed - printed;
    return {
      net, tax, shipping, other, discount, computed, printed, difference,
      matches: printed ? Math.abs(difference) <= Math.max(0.05, printed * 0.005) : null,
    };
  }, [header, lines]);

  return (
    <Dialog open={open} onClose={submitting ? undefined : handleClose} maxWidth="lg" fullWidth
      PaperProps={{ sx: { height: { md: '92vh' }, maxHeight: '92vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Sparkles size={22} color={colors.primary} />
        <Box sx={{ flexGrow: 1 }}>
          Upload Invoice
          {projectId && (
            <Chip size="small" label={`For project: ${projectName || projectId}`}
              sx={{ ml: 1.5, bgcolor: colors.accentSoft, color: colors.accent, fontWeight: 700 }} />
          )}
          {capturedOnPhone && (
            <Chip size="small" icon={<Smartphone size={13} />} label="Captured on phone"
              sx={{ ml: 1.5, bgcolor: colors.primarySoft, color: colors.primary, fontWeight: 600 }} />
          )}
          {result?.mock && (
            <Chip size="small" label="Sample data — set OPENAI_API_KEY to enable AI extraction"
              sx={{ ml: 1.5, bgcolor: colors.warningSoft, color: colors.warning, fontWeight: 600 }} />
          )}
        </Box>
        <IconButton onClick={handleClose} disabled={submitting}><X size={20} /></IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        {error && <Alert severity="error" sx={{ m: 2, mb: 0 }} onClose={() => setError('')}>{error}</Alert>}

        {(!file && !header) ? (
          <Box sx={{ p: 4, display: 'grid', placeItems: 'center', minHeight: 320, gap: 2 }}>
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
              <Typography sx={{ color: colors.textMuted, mt: 0.5 }}>PDF, JPG, PNG or CSV · up to 10&nbsp;MB</Typography>
            </Box>
            <input ref={fileRef} type="file" hidden accept={ACCEPT} onChange={(e) => handleFile(e.target.files?.[0])} />

            {/* Capture on a phone instead */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', maxWidth: 560 }}>
              <Divider sx={{ flexGrow: 1 }} />
              <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted }}>or</Typography>
              <Divider sx={{ flexGrow: 1 }} />
            </Box>
            <Button variant="outlined" startIcon={<Smartphone size={18} />} onClick={() => setPhoneScanOpen(true)}>
              Scan a QR to capture on your phone
            </Button>
          </Box>
        ) : (
          <Grid container sx={{ height: '100%' }}>
            {/* Invoice preview */}
            <Grid item xs={12} md={5} sx={{ borderRight: { md: `1px solid ${colors.border}` }, bgcolor: '#F4F3F1', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1 }}>
                <FileText size={17} color={colors.textSecondary} />
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, flexGrow: 1 }} noWrap>
                  {file ? file.name : 'Captured on phone'}
                </Typography>
                <Button size="small" startIcon={<RefreshCw size={15} />} onClick={reset}>Replace</Button>
              </Box>
              <Divider />
              <Box sx={{ flexGrow: 1, overflow: 'auto', p: 1.5, display: 'grid', placeItems: (isPdf || isCsv) ? 'stretch' : 'center' }}>
                {loading ? (
                  <Box sx={{ display: 'grid', placeItems: 'center', gap: 1.5, alignSelf: 'center', justifySelf: 'center' }}>
                    <CircularProgress /><Typography sx={{ color: colors.textSecondary }}>Reading invoice…</Typography>
                  </Box>
                ) : !previewUrl ? (
                  <Box sx={{ display: 'grid', placeItems: 'center', gap: 1, alignSelf: 'center', justifySelf: 'center', color: colors.textMuted }}>
                    <Smartphone size={40} color={colors.textSecondary} />
                    <Typography sx={{ fontSize: '0.875rem' }}>Photo captured on your phone</Typography>
                  </Box>
                ) : (isPdf || isCsv) ? (
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

                  {warnings.length > 0 && (
                    <Alert severity="warning" sx={{ mt: 2.5, textAlign: 'left' }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', mb: 0.5 }}>
                        Figures checked against the invoice
                      </Typography>
                      <Box component="ul" sx={{ m: 0, pl: 2.25 }}>
                        {warnings.map((w, i) => (
                          <Typography key={i} component="li" sx={{ fontSize: '0.8125rem' }}>{w}</Typography>
                        ))}
                      </Box>
                    </Alert>
                  )}

                  <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, mt: 3, mb: 1 }}>
                    Line Items · resolve each to a Component or Equipment
                  </Typography>

                  {lines.map((l, i) => {
                    const b = badgeFor(l);
                    const isActionable = isActionableRes(l.resolution);
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
                              {/* Rack no rather than the generated item code: the code is
                                  hidden from the UI now, and the rack is what tells two
                                  similarly named parts apart on the shelf. */}
                              {components.map((c) => (
                                <MenuItem key={`c${c.id}`} value={`comp:${c.id}`}>{c.componentName}{c.rackNo ? ` · Rack ${c.rackNo}` : ''}</MenuItem>
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
                              onChange={(e) => setLine(i, { quantity: e.target.value })} disabled={!isActionable} />
                          </Grid>
                          <Grid item xs={4} sm={2.5}>
                            <TextField fullWidth size="small" label={`Unit Price (${CURRENCY_SYMBOL})`} type="number" value={l.unitPrice}
                              onChange={(e) => setLine(i, { unitPrice: e.target.value })} disabled={!isActionable} />
                          </Grid>
                          <Grid item xs={4} sm={2.5}>
                            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, textAlign: 'right', color: isActionable ? colors.textPrimary : colors.textMuted }}>
                              {isActionable ? formatCurrency(Number(l.quantity || 0) * Number(l.unitPrice || 0)) : '—'}
                            </Typography>
                          </Grid>
                        </Grid>
                        {l.match && (() => {
                          const using = l.resolution === 'EXISTING_COMPONENT' && Number(l.componentId) === l.match.id;
                          const qty = Number(l.quantity) || 0;
                          if (using) {
                            return (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1, px: 1.25, py: 0.75,
                                borderRadius: 1.5, bgcolor: colors.successSoft }}>
                                <Check size={14} color={colors.success} style={{ flexShrink: 0 }} />
                                <Typography sx={{ fontSize: '0.75rem', color: colors.textSecondary }}>
                                  Already in stock as <b>{l.match.name}</b> — {l.match.stock.toLocaleString()} now,{' '}
                                  {(l.match.stock + qty).toLocaleString()} after this invoice.
                                  {l.match.confidence !== 'SURE' && l.match.note ? ` Check: ${l.match.note}.` : ''}
                                </Typography>
                              </Box>
                            );
                          }
                          if (l.match.confidence !== 'POSSIBLE' || l.resolution === 'SKIP') return null;
                          return (
                            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 1, px: 1.25, py: 0.75,
                              borderRadius: 1.5, bgcolor: colors.warningSoft }}>
                              <Typography sx={{ fontSize: '0.75rem', color: colors.textSecondary, flexGrow: 1, minWidth: 0 }}>
                                Possibly already in stock: <b>{l.match.name}</b> ({l.match.stock.toLocaleString()} on hand)
                                {l.match.note ? ` — ${l.match.note}` : ''}
                              </Typography>
                              <Button size="small" variant="outlined" sx={{ flexShrink: 0, py: 0.25 }}
                                onClick={() => setLine(i, { resolution: 'EXISTING_COMPONENT', componentId: l.match.id, equipmentId: null })}>
                                Add to this instead
                              </Button>
                            </Box>
                          );
                        })()}
                        {projectId && isComponentRes(l.resolution) && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.25 }}>
                            <FolderInput size={16} color={colors.accent} style={{ flexShrink: 0 }} />
                            <TextField select size="small" label="Goes into project folder" value={l.folder || 'here'}
                              onChange={(e) => setLine(i, { folder: e.target.value })} sx={{ minWidth: 0, flexGrow: 1, maxWidth: 420 }}>
                              <MenuItem value="here">{projectName || 'This project'} (scanned here)</MenuItem>
                              {otherProjects.map((p) => (
                                <MenuItem key={p.id} value={`p:${p.id}`}>
                                  {p.projectName}{p.status && p.status !== 'ACTIVE' ? ` · ${p.status.replace('_', ' ').toLowerCase()}` : ''}
                                </MenuItem>
                              ))}
                              <MenuItem value="none"><em>General stock — no project</em></MenuItem>
                            </TextField>
                          </Box>
                        )}
                        <InventoryPathEditor line={l} categories={categories} components={components}
                          equipment={equipment} onChange={(patch) => setLine(i, patch)} />
                      </Box>
                    );
                  })}

                  <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${colors.border}` }}>
                    <Typography sx={{ fontSize: '0.875rem', color: colors.textMuted, mb: 1.25 }}>
                      {componentLines.length} stock line(s){newCount ? ` · ${newCount} new` : ''}{equipCount ? ` · ${equipCount} equipment` : ''}{skipCount ? ` · ${skipCount} skipped` : ''}
                    </Typography>
                    {projectId && folderSummary.length > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75, mb: 1.25 }}>
                        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: colors.textSecondary }}>Goes into:</Typography>
                        {folderSummary.map((f) => (
                          <Chip key={f.f} size="small" label={`${f.name} · ${f.count} line${f.count === 1 ? '' : 's'}`}
                            sx={{ fontWeight: 600, bgcolor: f.f === 'none' ? '#F2F1EE' : colors.accentSoft,
                              color: f.f === 'none' ? colors.textSecondary : colors.accent }} />
                        ))}
                      </Box>
                    )}

                    {totals && (
                      <Box sx={{ p: 1.75, borderRadius: 2.5, bgcolor: colors.canvas, border: `1px solid ${colors.border}` }}>
                        <TotalRow label="Line items (net)" value={totals.net} />
                        {Boolean(totals.discount) && <TotalRow label="Discount" value={-totals.discount} />}
                        {Boolean(totals.tax) && <TotalRow label="Tax" value={totals.tax} />}
                        {Boolean(totals.shipping) && <TotalRow label="Shipping" value={totals.shipping} />}
                        {Boolean(totals.other) && <TotalRow label="Other charges" value={totals.other} />}
                        <Divider sx={{ my: 1 }} />
                        <TotalRow label="Extracted lines add up to" value={totals.computed} strong />
                        {Boolean(totals.printed) && (
                          <TotalRow label="Grand total printed on the invoice" value={totals.printed} strong />
                        )}

                        {totals.matches === true && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1 }}>
                            <Check size={16} color={colors.success} />
                            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: colors.success }}>
                              Matches the invoice total exactly.
                            </Typography>
                          </Box>
                        )}
                        {totals.matches === false && (
                          <Alert severity="warning" sx={{ mt: 1, py: 0.5 }}>
                            <Typography sx={{ fontSize: '0.8125rem' }}>
                              Off by {formatCurrency(Math.abs(totals.difference))} against the invoice.
                              Check the quantity and unit price on each line before confirming.
                            </Typography>
                          </Alert>
                        )}
                        {totals.matches === null && (
                          <Typography sx={{ fontSize: '0.78rem', color: colors.textMuted, mt: 1 }}>
                            No grand total was printed on this invoice, so there is nothing to check against.
                          </Typography>
                        )}
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 1, mt: 1.5 }}>
                      <Typography sx={{ fontSize: '0.8125rem', color: colors.textMuted }}>
                        Value of the stock being added (component lines only)
                      </Typography>
                      <Typography sx={{ fontSize: '1.0625rem', fontWeight: 700 }}>{formatCurrency(linesTotal)}</Typography>
                    </Box>
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

      <PhoneScanDialog
        open={phoneScanOpen}
        onClose={() => setPhoneScanOpen(false)}
        onResult={handlePhoneResult}
      />
    </Dialog>
  );
};

export default InvoiceUploadDialog;
