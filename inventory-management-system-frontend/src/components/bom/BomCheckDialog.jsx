import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, Button, IconButton, TextField,
  CircularProgress, Alert, Chip, Table, TableHead, TableRow, TableCell, TableBody, InputAdornment, Tooltip,
} from '@mui/material';
import {
  X, FileSpreadsheet, UploadCloud, Download, RefreshCw, PackageCheck, PackageX, PackageMinus, Layers, Search,
  CircleHelp, Info,
} from 'lucide-react';
import { checkBom } from '../../api/bomApi';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { colors } from '../../theme/tokens';

const ACCEPT = '.xlsx,.xls,.xlsm,.csv,.tsv,.txt';
const isAllowed = (f) => /\.(xlsx|xls|xlsm|csv|tsv|txt)$/i.test(f?.name || '');

const STATUS = {
  AVAILABLE: { label: 'In stock', fg: colors.success, bg: colors.successSoft },
  PARTIAL: { label: 'Partial', fg: colors.warning, bg: colors.warningSoft },
  TO_ORDER: { label: 'Order', fg: colors.danger, bg: colors.dangerSoft },
  // A possible match only: not counted as in stock until someone confirms it.
  VERIFY: { label: 'Verify', fg: colors.accent, bg: colors.accentSoft },
};

// ---- CSV export -----------------------------------------------------------------
// Cells starting with = + - @ are prefixed so Excel never runs BOM text as a formula.
const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const downloadCsv = (rows, boards, filename) => {
  const header = ['BOM row', 'Part number', 'Name / description', 'Value', 'Footprint', 'Designators',
    'Qty per board', 'Boards', 'Qty needed', 'In stock', 'Allocated', 'To order', 'Status',
    'Matched component', 'Category', 'Rack', 'Location', 'Match', 'Note', 'Other candidates'];
  const body = rows.map((l) => [
    l.rowNumber, l.bomPart, l.bomName, l.bomValue, l.bomFootprint, l.designators,
    l.quantityPerBoard, boards, l.requiredQuantity, l.componentId ? l.inStock : '', l.allocated, l.toOrder,
    STATUS[l.status]?.label, l.componentName, l.category, l.rackNo, l.location,
    l.componentId ? `${l.matchType} (${l.confidence})` : 'Not in inventory',
    l.note || '',
    (l.alternatives || []).map((a) => `${a.componentName} (${a.inStock} in stock)`).join('; '),
  ]);
  // Leading byte-order mark so Excel opens the UTF-8 file with the right encoding (Ω, µ…).
  const UTF8_BOM = String.fromCharCode(0xFEFF);
  const csv = UTF8_BOM + [header, ...body].map((r) => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const baseName = (name) => (name || 'bom').replace(/\.[^.]+$/, '');

/** Why a match needs a look ("Spelling differs…", "Different voltage version…", "In Equipment…"). */
const MatchNote = ({ text }) => (
  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start', mt: 0.5 }}>
    <Info size={12} color={colors.textMuted} style={{ marginTop: 2, flexShrink: 0 }} />
    <Typography sx={{ fontSize: '0.72rem', color: colors.textSecondary, wordBreak: 'break-word' }}>{text}</Typography>
  </Box>
);

// ---- small pieces ------------------------------------------------------------------
const SummaryCard = ({ icon: Icon, label, count, fg, bg, active, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      flex: '1 1 150px', minWidth: 0, p: 1.5, borderRadius: 2.5, cursor: 'pointer',
      border: `1.5px solid ${active ? fg : colors.border}`, bgcolor: active ? bg : colors.paper,
      transition: 'border-color .15s ease, background-color .15s ease',
      '&:hover': { borderColor: fg },
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: fg }}>
      <Icon size={17} />
      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: colors.textSecondary }}>{label}</Typography>
    </Box>
    <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: fg, lineHeight: 1.2, mt: 0.5 }}>{count}</Typography>
  </Box>
);

// Where the matched part lives: "Capacitor › SMD › 100nF", then rack and location.
const matchedWhere = (l) => [
  [l.category, l.type, l.value].filter((x) => x && String(x).trim()).join(' › '),
  l.rackNo && `Rack ${l.rackNo}`,
  l.location,
].filter(Boolean);

const primaryLabel = (l) => l.bomPart || l.bomName || l.bomValue || `Row ${l.rowNumber}`;
const secondaryLabel = (l) => {
  const primary = primaryLabel(l);
  return [
    l.bomName && l.bomName !== primary ? l.bomName : null,
    l.bomValue && l.bomValue !== primary ? l.bomValue : null,
    l.bomFootprint,
    l.designators ? `Ref: ${l.designators}` : null,
  ].filter(Boolean).join(' · ');
};

// ---- dialog ------------------------------------------------------------------------
/**
 * Upload a BOM / Excel parts list and see what is in stock vs. what to order.
 * Purely a read — nothing in the inventory is created, changed or deleted.
 */
const BomCheckDialog = ({ open, onClose }) => {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const reqId = useRef(0);
  const [file, setFile] = useState(null);
  const [boards, setBoards] = useState('1');
  const debouncedBoards = useDebouncedValue(boards, 450);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const boardsNum = Math.max(1, Math.min(100000, parseInt(debouncedBoards, 10) || 1));

  const run = useCallback(async (f, b, pickTab) => {
    const id = ++reqId.current; // ignore stale responses if the user changes input quickly
    setLoading(true);
    setError('');
    try {
      const res = await checkBom(f, b);
      if (id !== reqId.current) return;
      const d = res.data;
      setResult(d);
      if (pickTab) {
        setFilter(d.toOrderCount > 0 ? 'TO_ORDER' : d.verifyCount > 0 ? 'VERIFY'
          : d.partialCount > 0 ? 'PARTIAL' : 'ALL');
      }
    } catch (err) {
      if (id !== reqId.current) return;
      setResult(null);
      setError(err.response?.data?.message
        || 'Could not read this file. Please upload a BOM in Excel (.xlsx/.xls) or CSV format.');
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  // Re-check when the board count changes (debounced), using the same file.
  useEffect(() => {
    if (file) run(file, boardsNum, false);
  }, [boardsNum]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFile = (f) => {
    if (!f) return;
    if (!isAllowed(f)) {
      setError('Please choose an Excel (.xlsx, .xls) or CSV file.');
      return;
    }
    setFile(f);
    setQuery('');
    run(f, boardsNum, true);
  };

  const reset = () => {
    reqId.current += 1;
    setFile(null);
    setResult(null);
    setError('');
    setQuery('');
    setLoading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const lines = useMemo(() => {
    if (!result) return [];
    const q = query.trim().toLowerCase();
    return result.lines
      .filter((l) => filter === 'ALL' || l.status === filter)
      .filter((l) => !q || [l.bomPart, l.bomName, l.bomValue, l.designators, l.bomFootprint, l.componentName]
        .some((s) => s && String(s).toLowerCase().includes(q)));
  }, [result, filter, query]);

  const orderLines = useMemo(
    () => (result ? result.lines.filter((l) => l.toOrder > 0 || l.status === 'VERIFY') : []), [result]);

  const openComponent = (name) => {
    onClose?.();
    navigate(`/components?q=${encodeURIComponent(name)}`);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth
      PaperProps={{ sx: { height: { md: result ? '92vh' : 'auto' }, maxHeight: '92vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <FileSpreadsheet size={22} color={colors.primary} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>Check BOM against inventory</Typography>
          <Typography sx={{ fontSize: '0.8rem', color: colors.textMuted }}>
            Upload a BOM or Excel parts list to see what is in stock and what needs ordering. Nothing in the inventory is changed.
          </Typography>
        </Box>
        <IconButton onClick={onClose}><X size={20} /></IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

        {/* Upload + boards */}
        {!result ? (
          <Box sx={{ display: 'grid', gap: 2 }}>
            <Box
              onClick={() => !loading && fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
              sx={{
                p: { xs: 4, sm: 6 }, textAlign: 'center', cursor: loading ? 'progress' : 'pointer', borderRadius: 4,
                border: `2px dashed ${dragOver ? colors.primary : colors.borderStrong}`,
                bgcolor: dragOver ? colors.primarySoft : colors.canvas,
                transition: 'border-color .18s ease, background-color .18s ease',
                '&:hover': { borderColor: colors.primary, bgcolor: colors.primarySoft },
              }}
            >
              {loading ? (
                <Box sx={{ display: 'grid', placeItems: 'center', gap: 1.5 }}>
                  <CircularProgress />
                  <Typography sx={{ color: colors.textSecondary }}>Checking {file?.name}…</Typography>
                </Box>
              ) : (
                <>
                  <UploadCloud size={44} color={colors.primary} />
                  <Typography sx={{ fontSize: '1.1rem', fontWeight: 600, mt: 1.5 }}>
                    Drop your BOM here, or click to browse
                  </Typography>
                  <Typography sx={{ color: colors.textMuted, mt: 0.5, fontSize: '0.875rem' }}>
                    Excel (.xlsx, .xls) or CSV · KiCad, Altium, EasyEDA/JLCPCB or your own sheet
                  </Typography>
                </>
              )}
            </Box>
            <input ref={fileRef} type="file" hidden accept={ACCEPT} onChange={(e) => handleFile(e.target.files?.[0])} />

            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
              <TextField size="small" type="number" label="Boards to build" value={boards}
                onChange={(e) => setBoards(e.target.value)} inputProps={{ min: 1, max: 100000 }}
                sx={{ width: 160 }} />
              <Typography sx={{ fontSize: '0.8125rem', color: colors.textMuted, flex: '1 1 260px' }}>
                Every BOM quantity is multiplied by this. The file needs a part column (Part Number, MPN, Comment,
                Name or Value); quantity comes from a Qty column, or is counted from the designators.
              </Typography>
            </Box>
          </Box>
        ) : (
          <>
            {/* File bar */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
              <FileSpreadsheet size={18} color={colors.textSecondary} />
              <Typography sx={{ fontWeight: 600, minWidth: 0 }} noWrap>
                {result.fileName}{result.sheetName ? ` · sheet "${result.sheetName}"` : ''}
              </Typography>
              {loading && <CircularProgress size={16} />}
              <Box sx={{ flexGrow: 1 }} />
              <TextField size="small" type="number" label="Boards to build" value={boards}
                onChange={(e) => setBoards(e.target.value)} inputProps={{ min: 1, max: 100000 }}
                sx={{ width: 150 }} />
              <Button size="small" startIcon={<RefreshCw size={15} />} onClick={reset}>Check another file</Button>
            </Box>

            {/* Summary */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
              <SummaryCard icon={Layers} label="BOM lines" count={result.totalLines}
                fg={colors.primary} bg={colors.primarySoft} active={filter === 'ALL'} onClick={() => setFilter('ALL')} />
              <SummaryCard icon={PackageCheck} label="In stock" count={result.availableCount}
                fg={colors.success} bg={colors.successSoft} active={filter === 'AVAILABLE'} onClick={() => setFilter('AVAILABLE')} />
              <SummaryCard icon={PackageMinus} label="Partially in stock" count={result.partialCount}
                fg={colors.warning} bg={colors.warningSoft} active={filter === 'PARTIAL'} onClick={() => setFilter('PARTIAL')} />
              <SummaryCard icon={PackageX} label="Need to order" count={result.toOrderCount}
                fg={colors.danger} bg={colors.dangerSoft} active={filter === 'TO_ORDER'} onClick={() => setFilter('TO_ORDER')} />
              {result.verifyCount > 0 && (
                <SummaryCard icon={CircleHelp} label="To verify" count={result.verifyCount}
                  fg={colors.accent} bg={colors.accentSoft} active={filter === 'VERIFY'} onClick={() => setFilter('VERIFY')} />
              )}
            </Box>

            {result.readyToBuild ? (
              <Alert severity="success">
                Everything is in stock — ready to build {result.boards} board{result.boards > 1 ? 's' : ''}.
              </Alert>
            ) : (
              <Alert severity="info">
                {orderLines.length} line{orderLines.length === 1 ? '' : 's'} need ordering
                for {result.boards} board{result.boards > 1 ? 's' : ''}. Download the order list below.
              </Alert>
            )}
            {result.verifyCount > 0 && (
              <Alert severity="warning">
                {result.verifyCount} line{result.verifyCount === 1 ? ' has' : 's have'} only a possible match
                (status <b>Verify</b>) — not counted as in stock until you confirm the part. The note under
                each one says what differs.
              </Alert>
            )}

            {(Object.keys(result.detectedColumns || {}).length > 0 || result.warnings?.length > 0) && (
              <Box sx={{ fontSize: '0.78rem', color: colors.textMuted, display: 'grid', gap: 0.25 }}>
                {Object.keys(result.detectedColumns || {}).length > 0 && (
                  <span>
                    Read columns: {Object.entries(result.detectedColumns)
                      .map(([field, header]) => `${field} ← "${header}"`).join(' · ')}
                  </span>
                )}
                {result.warnings?.map((w) => <span key={w}>• {w}</span>)}
              </Box>
            )}

            {/* Filter + table */}
            <TextField size="small" placeholder="Filter these results…" value={query}
              onChange={(e) => setQuery(e.target.value)} sx={{ maxWidth: 360 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> }} />

            <Box sx={{ overflowX: 'auto', border: `1px solid ${colors.border}`, borderRadius: 2, flexShrink: 0 }}>
              <Table size="small" stickyHeader sx={{ minWidth: 860 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 56 }}>Row</TableCell>
                    <TableCell>BOM part</TableCell>
                    <TableCell align="right">Needed</TableCell>
                    <TableCell align="right">In stock</TableCell>
                    <TableCell>Matched in inventory</TableCell>
                    <TableCell align="right">To order</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: colors.textMuted }}>
                        Nothing in this list.
                      </TableCell>
                    </TableRow>
                  ) : lines.map((l) => {
                    const st = STATUS[l.status] || STATUS.TO_ORDER;
                    const sub = secondaryLabel(l);
                    return (
                      <TableRow key={`${l.rowNumber}-${primaryLabel(l)}`} hover>
                        <TableCell sx={{ color: colors.textMuted }}>{l.rowNumber}</TableCell>
                        <TableCell sx={{ maxWidth: 320 }}>
                          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', wordBreak: 'break-word' }}>
                            {primaryLabel(l)}
                          </Typography>
                          {sub && (
                            <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted, wordBreak: 'break-word' }}>
                              {sub}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {l.requiredQuantity}
                          {result.boards > 1 && (
                            <Typography component="span" sx={{ display: 'block', fontSize: '0.7rem', color: colors.textMuted, fontWeight: 400 }}>
                              {l.quantityPerBoard} × {result.boards}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">{l.componentId ? l.inStock : '—'}</TableCell>
                        <TableCell sx={{ maxWidth: 300 }}>
                          {l.componentId ? (
                            <>
                              <Tooltip title="Open this component">
                                <Typography component="button" type="button" onClick={() => openComponent(l.componentName)}
                                  sx={{
                                    all: 'unset', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
                                    color: colors.primary, wordBreak: 'break-word', '&:hover': { textDecoration: 'underline' },
                                  }}>
                                  {l.componentName}
                                </Typography>
                              </Tooltip>
                              {matchedWhere(l).filter(Boolean).length > 0 && (
                                <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted }}>
                                  {matchedWhere(l).filter(Boolean).join(' · ')}
                                </Typography>
                              )}
                              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                                {l.confidence === 'LOW' && (
                                  <Chip size="small" label="Verify match"
                                    sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, bgcolor: colors.warningSoft, color: colors.warning }} />
                                )}
                                {l.confidence === 'MEDIUM' && (
                                  <Chip size="small" label="Likely match"
                                    sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600, bgcolor: colors.infoSoft, color: colors.info }} />
                                )}
                                {l.componentInactive && (
                                  <Chip size="small" label="Marked Not Available"
                                    sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600, bgcolor: colors.dangerSoft, color: colors.danger }} />
                                )}
                              </Box>
                              {l.note && <MatchNote text={l.note} />}
                              {l.alternatives?.length > 0 && (
                                <Typography sx={{ fontSize: '0.72rem', color: colors.textSecondary, mt: 0.5 }}>
                                  Also similar:{' '}
                                  {l.alternatives.map((a, i) => (
                                    <Box key={a.componentId} component="span">
                                      {i > 0 && ', '}
                                      <Box component="button" type="button" onClick={() => openComponent(a.componentName)}
                                        sx={{ all: 'unset', cursor: 'pointer', color: colors.primary, '&:hover': { textDecoration: 'underline' } }}>
                                        {a.componentName}
                                      </Box>
                                      {' '}({a.inStock} in stock)
                                    </Box>
                                  ))}
                                </Typography>
                              )}
                            </>
                          ) : (
                            <>
                              <Typography sx={{ fontSize: '0.8125rem', color: colors.textMuted }}>Not in inventory</Typography>
                              {l.note && <MatchNote text={l.note} />}
                            </>
                          )}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: l.toOrder > 0 ? colors.danger : colors.textMuted }}>
                          {l.toOrder > 0 ? l.toOrder : '—'}
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={st.label}
                            sx={{ fontWeight: 700, bgcolor: st.bg, color: st.fg }} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, flexWrap: 'wrap', gap: 1 }}>
        {result && (
          <>
            <Button variant="contained" startIcon={<Download size={16} />} disabled={orderLines.length === 0}
              onClick={() => downloadCsv(orderLines, result.boards, `${baseName(result.fileName)}-order-list.csv`)}>
              Download order list ({orderLines.length})
            </Button>
            <Button variant="outlined" startIcon={<Download size={16} />}
              onClick={() => downloadCsv(result.lines, result.boards, `${baseName(result.fileName)}-stock-check.csv`)}>
              Full report
            </Button>
          </>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="text" onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default BomCheckDialog;
