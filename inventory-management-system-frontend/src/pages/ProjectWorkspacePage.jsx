import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Autocomplete, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, InputAdornment, LinearProgress, Link, MenuItem, Snackbar, Tab, Tabs, TextField,
  ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import {
  ArrowLeft, ArrowRightLeft, Boxes, FolderKanban, FolderOpen, History, IndianRupee, PackageCheck, PackageMinus,
  PackagePlus, Plus, Receipt, ScanLine, Search, ShoppingCart, Trash2, Wallet,
} from 'lucide-react';
import {
  addProjectComponent, getProjectById, getProjectFolder, getProjectPurchases, getProjects, getProjectUsagesByProject,
  recordProjectUsage, releaseProjectEntry, transferProjectComponent,
} from '../api/projectApi';
import { getComponents } from '../api/componentApi';
import { getComponentCategories } from '../api/componentCategoryApi';
import { downloadInvoice } from '../api/purchaseApi';
import { useAuth } from '../auth/AuthContext';
import { canWrite } from '../utils/roleUtils';
import DataTable from '../components/common/DataTable';
import ConfirmDialog from '../components/common/ConfirmDialog';
import ComponentFormDialog from '../components/components/ComponentFormDialog';
import InvoiceUploadDialog from '../components/purchases/InvoiceUploadDialog';
import PurchaseDetailsDrawer from '../components/purchases/PurchaseDetailsDrawer';
import { PageHeader, StatusBadge } from '../components/ui';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { formatCurrency } from '../utils/currency';
import { colors } from '../theme/tokens';

const SOURCE = {
  BOUGHT: { label: 'Bought', fg: colors.success, bg: colors.successSoft, hint: 'Bought for this project (stock was added)' },
  INVOICE: { label: 'Invoice', fg: colors.info, bg: colors.infoSoft, hint: 'From a scanned invoice' },
  RESERVED: { label: 'From stock', fg: colors.accent, bg: colors.accentSoft, hint: 'Set aside from existing stock' },
};

const projectStatus = (s) => ({ ACTIVE: 'active', COMPLETED: 'completed', ON_HOLD: 'pending' }[s] || 'default');
const dateLabel = (v) => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const path = (r) => [r.category, r.type, r.value].filter(Boolean).join(' › ');

const SourceChip = ({ source }) => {
  const s = SOURCE[source] || SOURCE.BOUGHT;
  return (
    <Tooltip title={s.hint}>
      <Chip size="small" label={s.label}
        sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, bgcolor: s.bg, color: s.fg }} />
    </Tooltip>
  );
};

/** One figure in the cost summary strip. */
const Stat = ({ icon: Icon, label, value, caption, tone = colors.primary, children }) => (
  <Card sx={{ p: 2, flex: '1 1 180px', minWidth: 0 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
      <Box sx={{ width: 28, height: 28, borderRadius: '8px', display: 'grid', placeItems: 'center', bgcolor: `${tone}14`, color: tone }}>
        <Icon size={15} />
      </Box>
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {label}
      </Typography>
    </Box>
    <Typography sx={{ fontSize: '1.3rem', fontWeight: 700, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
      {value}
    </Typography>
    {caption && <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted, mt: 0.25 }}>{caption}</Typography>}
    {children}
  </Card>
);

// ================================================================== add component

const AddComponentDialog = ({ open, onClose, project, onAdded, notify }) => {
  const [mode, setMode] = useState('BOUGHT');
  const [components, setComponents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [picked, setPicked] = useState(null);
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newOpen, setNewOpen] = useState(false);

  const loadComponents = useCallback(
    () => getComponents({ page: 0, size: 500 }).then((r) => r.data?.content || []), []);

  useEffect(() => {
    if (!open) return;
    setMode('BOUGHT'); setPicked(null); setQty(''); setPrice(''); setNotes(''); setError('');
    loadComponents().then(setComponents).catch(() => setComponents([]));
    getComponentCategories().then((r) => setCategories(r.data || [])).catch(() => {});
  }, [open, loadComponents]);

  const free = picked ? Math.max((picked.quantity || 0) - (picked.reservedForProjects || 0), 0) : 0;
  const q = Number(qty);
  const qtyOk = Number.isInteger(q) && q >= 1;
  const tooMany = mode === 'RESERVED' && picked && qtyOk && q > free;
  const unit = price === '' ? Number(picked?.unitPrice || 0) : Number(price);
  const canSave = picked && qtyOk && !tooMany && !busy;

  const pick = (c) => {
    setPicked(c);
    setPrice(c?.unitPrice != null ? String(c.unitPrice) : '');
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await addProjectComponent(project.id, {
        componentId: picked.id, quantity: q, mode,
        unitPrice: price === '' ? null : Number(price), notes: notes.trim() || null,
      });
      onAdded(res.data, `${q} × ${picked.componentName} added to ${project.projectName}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add this component.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PackagePlus size={20} color={colors.primary} /> Add component to {project?.projectName}
        </DialogTitle>
        <DialogContent>
          <ToggleButtonGroup exclusive fullWidth size="small" value={mode} onChange={(_, v) => v && setMode(v)} sx={{ mb: 1 }}>
            <ToggleButton value="BOUGHT" sx={{ textTransform: 'none', fontWeight: 600 }}>
              <ShoppingCart size={15} style={{ marginRight: 6 }} /> Bought for this project
            </ToggleButton>
            <ToggleButton value="RESERVED" sx={{ textTransform: 'none', fontWeight: 600 }}>
              <Boxes size={15} style={{ marginRight: 6 }} /> Take from existing stock
            </ToggleButton>
          </ToggleButtonGroup>
          <Typography sx={{ fontSize: '0.8rem', color: colors.textSecondary, mb: 2 }}>
            {mode === 'BOUGHT'
              ? 'New units bought for this project: they are added to the inventory and kept in this project’s folder.'
              : 'Units already in the inventory are set aside for this project. Stock does not change.'}
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Autocomplete
            options={components} value={picked} onChange={(_, c) => pick(c)}
            getOptionLabel={(c) => c.componentName || ''}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            filterOptions={(opts, { inputValue }) => {
              const s = inputValue.trim().toLowerCase().replace(/[\s\-_]/g, '');
              if (!s) return opts;
              return opts.filter((c) => [c.componentName, c.category, c.type, c.value, c.rackNo]
                .some((f) => String(f || '').toLowerCase().replace(/[\s\-_]/g, '').includes(s)));
            }}
            renderOption={(props, c) => {
              const { key, ...rest } = props;
              return (
                <Box component="li" key={key} {...rest} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }} noWrap>{c.componentName}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted }} noWrap>{path(c) || '—'}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', color: colors.textSecondary }}>
                    {Number(c.quantity || 0).toLocaleString()} in stock
                  </Typography>
                </Box>
              );
            }}
            renderInput={(params) => (
              <TextField {...params} label="Component" placeholder="Search the inventory…"
                helperText={picked
                  ? `${picked.quantity} in stock${picked.reservedForProjects ? ` · ${picked.reservedForProjects} already belong to projects` : ''}`
                  + ` · ${free} free`
                  : ' '} />
            )}
          />
          <Link component="button" type="button" underline="hover" onClick={() => setNewOpen(true)}
            sx={{ fontSize: '0.8125rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
            <Plus size={14} /> Not in the inventory yet? Create a new component
          </Link>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField label="Quantity" type="number" required value={qty} onChange={(e) => setQty(e.target.value)}
              inputProps={{ min: 1 }} error={tooMany}
              helperText={tooMany ? `Only ${free} free in stock` : mode === 'RESERVED' && picked ? `Up to ${free}` : ' '} />
            <TextField label="Price per unit (₹)" type="number" value={price} onChange={(e) => setPrice(e.target.value)}
              inputProps={{ min: 0, step: '0.01' }}
              helperText={mode === 'BOUGHT' ? 'What was paid — also updates the component’s price' : 'Defaults to the component’s price'} />
          </Box>
          <TextField label="Notes (optional)" fullWidth value={notes} onChange={(e) => setNotes(e.target.value)}
            inputProps={{ maxLength: 500 }} sx={{ mt: 1 }} placeholder="e.g. order ref, supplier, reason" />

          {picked && qtyOk && (
            <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: colors.primarySoft, display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '0.8125rem' }}>
                {q} × {picked.componentName}
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 700 }}>
                Adds {formatCurrency(q * unit)} to the project cost
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={!canSave}
            startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <PackagePlus size={15} />}>
            Add to project
          </Button>
        </DialogActions>
      </Dialog>

      {/* New part: the normal component form, starting with 0 in stock — the quantity
          bought is entered in the dialog above, which adds it as project stock. */}
      <ComponentFormDialog
        open={newOpen} onClose={() => setNewOpen(false)} component={null}
        initialValues={{ quantity: 0 }} categories={categories} canCreateCategory
        onCategoryCreated={() => getComponentCategories().then((r) => setCategories(r.data || []))}
        notify={notify}
        onSaved={async (message, saved) => {
          setNewOpen(false);
          notify(`${message} — now enter the quantity bought for the project`);
          const list = await loadComponents().catch(() => components);
          setComponents(list);
          const created = list.find((c) => c.id === saved?.id) || null;
          if (created) { setMode('BOUGHT'); pick(created); }
        }}
      />
    </>
  );
};

// ================================================================== record usage

const UsageDialog = ({ open, onClose, project, row, onDone }) => {
  const [qty, setQty] = useState('');
  const [date, setDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setQty(''); setDate(''); setRemarks(''); setError(''); }
  }, [open]);

  const q = Number(qty);
  const ok = row && Number.isInteger(q) && q >= 1 && q <= row.inStock && remarks.trim();

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await recordProjectUsage({
        projectId: project.id, componentId: row.componentId, quantityUsed: q,
        usageDate: date || null, remarks: remarks.trim(),
      });
      onDone(`${q} × ${row.componentName} used in ${project.projectName} — stock reduced`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not record the usage.');
    } finally {
      setBusy(false);
    }
  };

  if (!row) return null;
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Record usage</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{row.componentName}</Typography>
        <Typography sx={{ fontSize: '0.8rem', color: colors.textSecondary, mb: 2 }}>
          {row.remaining} left in this project · {row.inStock} in stock overall
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField label="Quantity used" type="number" fullWidth required value={qty}
          onChange={(e) => setQty(e.target.value)} inputProps={{ min: 1, max: row.inStock }}
          error={q > row.inStock}
          helperText={q > row.inStock ? `Only ${row.inStock} in stock`
            : q > row.remaining ? `More than the ${row.remaining} kept for this project — the rest comes from general stock` : ' '} />
        <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={date}
          onChange={(e) => setDate(e.target.value)} sx={{ mt: 1 }} helperText="Leave empty for today" />
        <TextField label="Remarks" fullWidth required value={remarks} onChange={(e) => setRemarks(e.target.value)}
          sx={{ mt: 1 }} placeholder="e.g. assembled 10 boards" />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={!ok || busy}
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <PackageMinus size={15} />}>
          Record usage
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ================================================================== move to another project

const TransferDialog = ({ open, onClose, project, row, onDone }) => {
  const [projects, setProjects] = useState([]);
  const [toId, setToId] = useState('');
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setToId(''); setQty(row ? String(row.remaining) : ''); setNotes(''); setError('');
    getProjects({ page: 0, size: 200, sortBy: 'projectName', sortDir: 'asc' })
      .then((r) => setProjects((r.data?.content || []).filter((p) => p.id !== project.id)))
      .catch(() => setProjects([]));
  }, [open, row, project]);

  const q = Number(qty);
  const qtyOk = row && Number.isInteger(q) && q >= 1 && q <= row.remaining;
  const target = projects.find((p) => p.id === toId);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await transferProjectComponent(project.id, {
        componentId: row.componentId, toProjectId: toId, quantity: q, notes: notes.trim() || null,
      });
      onDone(res.data, `${q} × ${row.componentName} moved to ${target?.projectName || 'the other project'}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not move these units.');
    } finally {
      setBusy(false);
    }
  };

  if (!row) return null;
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ArrowRightLeft size={20} color={colors.primary} /> Move to another project
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', wordBreak: 'break-word' }}>{row.componentName}</Typography>
        <Typography sx={{ fontSize: '0.8rem', color: colors.textSecondary, mb: 2 }}>
          {row.remaining} left in {project.projectName} ({row.allocated} in its folder, {row.used} used).
          Stock does not change — the units, their price and invoice move to the other project’s folder.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField select fullWidth required label="Move to project" value={toId}
          onChange={(e) => setToId(e.target.value)}
          helperText={projects.length ? ' ' : 'There is no other project to move to'}>
          {projects.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.projectName}{p.status && p.status !== 'ACTIVE' ? ` · ${p.status.replace('_', ' ').toLowerCase()}` : ''}
            </MenuItem>
          ))}
        </TextField>
        <TextField label="Quantity to move" type="number" fullWidth required value={qty} sx={{ mt: 1 }}
          onChange={(e) => setQty(e.target.value)} inputProps={{ min: 1, max: row.remaining }}
          error={qty !== '' && !qtyOk}
          helperText={qty !== '' && !qtyOk ? `Between 1 and ${row.remaining}` : `Up to ${row.remaining}`} />
        <TextField label="Notes (optional)" fullWidth value={notes} onChange={(e) => setNotes(e.target.value)}
          inputProps={{ maxLength: 200 }} sx={{ mt: 1 }} placeholder="e.g. invoice line belonged to TMS" />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={!toId || !qtyOk || busy}
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <ArrowRightLeft size={15} />}>
          Move
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ================================================================== page

const ProjectWorkspacePage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const writeAccess = canWrite(role);

  const [project, setProject] = useState(null);
  const [folder, setFolder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const [tab, setTab] = useState('components');
  const [addOpen, setAddOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [usageRow, setUsageRow] = useState(null);
  const [transferRow, setTransferRow] = useState(null);
  const [entriesRow, setEntriesRow] = useState(null);
  const [releaseEntry, setReleaseEntry] = useState(null);
  const [purchases, setPurchases] = useState(null);
  const [purchaseRow, setPurchaseRow] = useState(null);
  const [usage, setUsage] = useState(null);
  const [allComponents, setAllComponents] = useState([]);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const notify = (message, severity = 'success') => setSnack({ open: true, message, severity });

  const loadFolder = useCallback(async () => {
    try {
      const res = await getProjectFolder(projectId, debouncedKeyword.trim());
      setFolder(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load this project.');
    } finally {
      setLoading(false);
    }
  }, [projectId, debouncedKeyword]);

  useEffect(() => { loadFolder(); }, [loadFolder]);
  useEffect(() => {
    getProjectById(projectId).then((r) => setProject(r.data))
      .catch((err) => setError(err.response?.data?.message || 'Project not found.'));
  }, [projectId]);

  const loadPurchases = useCallback(() => {
    getProjectPurchases(projectId).then((r) => setPurchases(r.data || [])).catch(() => setPurchases([]));
  }, [projectId]);
  const loadUsage = useCallback(() => {
    getProjectUsagesByProject(projectId, { page: 0, size: 100, sortBy: 'usageDate', sortDir: 'desc' })
      .then((r) => setUsage(r.data?.content || [])).catch(() => setUsage([]));
  }, [projectId]);
  useEffect(() => {
    if (tab === 'invoices' && purchases === null) loadPurchases();
    if (tab === 'usage' && usage === null) loadUsage();
  }, [tab, purchases, usage, loadPurchases, loadUsage]);

  const refreshAll = () => { loadFolder(); setPurchases(null); setUsage(null); };

  const openInvoice = () => {
    // The dialog matches invoice lines against existing components by name.
    getComponents({ page: 0, size: 500 }).then((r) => setAllComponents(r.data?.content || [])).catch(() => {});
    setInvoiceOpen(true);
  };

  const budget = folder?.budget != null ? Number(folder.budget) : null;
  const spent = Number(folder?.totalCost || 0);
  const pct = budget ? Math.min((spent / budget) * 100, 100) : 0;
  const over = budget != null && spent > budget;
  const rows = folder?.items || [];
  const searching = debouncedKeyword.trim().length > 0;

  const columns = useMemo(() => [
    {
      field: 'componentName', headerName: 'Component',
      render: (r) => (
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', wordBreak: 'break-word' }}>{r.componentName}</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted }}>{path(r) || '—'}</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
            {r.sources.map((s) => <SourceChip key={s} source={s} />)}
            {r.allocated === 0 && (
              <Tooltip title="Used in this project but never added to its folder">
                <Chip size="small" label="Used only" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }} />
              </Tooltip>
            )}
            {r.searchMatch && (
              <Tooltip title={r.searchNote || ''}>
                <Chip size="small" label={r.searchMatch === 'POSSIBLE' ? 'Possible match' : 'Close match'}
                  sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, bgcolor: colors.infoSoft, color: colors.info }} />
              </Tooltip>
            )}
          </Box>
        </Box>
      ),
    },
    {
      field: 'rackNo', headerName: 'Rack',
      render: (r) => [r.rackNo, r.location].filter(Boolean).join(' · ') || <Box component="span" sx={{ color: colors.textMuted }}>—</Box>,
    },
    { field: 'allocated', headerName: 'In project', align: 'right', render: (r) => <b>{r.allocated.toLocaleString()}</b> },
    { field: 'used', headerName: 'Used', align: 'right', render: (r) => r.used.toLocaleString() },
    {
      field: 'remaining', headerName: 'Left', align: 'right',
      render: (r) => (
        <Box component="span" sx={{ fontWeight: 700, color: r.remaining > 0 ? colors.success : colors.textMuted }}>
          {r.remaining.toLocaleString()}
        </Box>
      ),
    },
    { field: 'unitPrice', headerName: 'Unit price', align: 'right', render: (r) => (r.unitPrice != null ? formatCurrency(r.unitPrice) : '—') },
    { field: 'totalCost', headerName: 'Cost', align: 'right', render: (r) => <b>{formatCurrency(r.totalCost)}</b> },
    {
      field: 'inStock', headerName: 'Total stock', align: 'right',
      render: (r) => (
        <Tooltip title="Units of this component in the whole inventory">
          <Box component="span" sx={{ color: colors.textSecondary }}>{r.inStock.toLocaleString()}</Box>
        </Tooltip>
      ),
    },
  ], []);

  if (error && !folder) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button startIcon={<ArrowLeft size={16} />} onClick={() => navigate('/projects')}>Back to projects</Button>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={project?.projectName || folder?.projectName || 'Project'}
        subtitle={project
          ? [project.projectManager && `Manager: ${project.projectManager}`,
            project.startDate && `${dateLabel(project.startDate)} – ${dateLabel(project.endDate)}`]
            .filter(Boolean).join(' · ') || 'Project folder'
          : 'Project folder'}
        icon={FolderOpen}
        breadcrumbs={[{ label: 'Manage' }, { label: 'Projects', href: '/projects' }, { label: project?.projectName || '…' }]}
        actions={(
          <>
            <Button variant="text" startIcon={<ArrowLeft size={16} />} onClick={() => navigate('/projects')}>Projects</Button>
            {writeAccess && (
              <>
                <Button variant="outlined" startIcon={<ScanLine size={16} />} onClick={openInvoice}>
                  Scan / upload invoice
                </Button>
                <Button variant="contained" startIcon={<PackagePlus size={16} />} onClick={() => setAddOpen(true)}>
                  Add component
                </Button>
              </>
            )}
          </>
        )}
      />

      {project && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <StatusBadge status={projectStatus(project.status)} label={project.status?.replace('_', ' ')} />
          {project.priority && <Chip size="small" label={`${project.priority} priority`} sx={{ fontWeight: 600 }} />}
        </Box>
      )}

      {loading && !folder ? (
        <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>
      ) : folder && (
        <>
          {/* Cost summary — always for the whole folder, whatever the search box says. */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2.5 }}>
            <Stat icon={Wallet} label="Budget" value={budget != null ? formatCurrency(budget) : 'Not set'}
              caption={budget != null ? `${Math.round((spent / budget) * 100) || 0}% spent on components` : 'Set it with Edit project'}>
              {budget != null && (
                <LinearProgress variant="determinate" value={pct}
                  sx={{ mt: 1, height: 6, borderRadius: 3, bgcolor: colors.border, '& .MuiLinearProgress-bar': { bgcolor: over ? colors.danger : colors.primary } }} />
              )}
            </Stat>
            <Stat icon={IndianRupee} label="Components cost" value={formatCurrency(spent)}
              caption={`${folder.componentCount} component${folder.componentCount === 1 ? '' : 's'} · ${folder.unitsInFolder.toLocaleString()} units`} />
            <Stat icon={PackageCheck} label="Used so far" value={formatCurrency(folder.usedValue)}
              caption={`${folder.unitsUsed.toLocaleString()} units used`} tone={colors.success} />
            <Stat icon={Wallet} label="Budget left"
              value={folder.budgetLeft != null ? formatCurrency(folder.budgetLeft) : '—'}
              caption={over ? 'Over budget' : budget != null ? 'Budget − components cost' : 'No budget set'}
              tone={over ? colors.danger : colors.success} />
            {writeAccess && (
              <Stat icon={Receipt} label="Invoices" value={formatCurrency(folder.invoiceTotal)}
                caption={`${folder.invoiceCount} invoice${folder.invoiceCount === 1 ? '' : 's'} for this project`} tone={colors.accent} />
            )}
          </Box>

          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: `1px solid ${colors.border}` }}>
            <Tab value="components" label={`Components (${folder.componentCount})`} icon={<FolderKanban size={16} />} iconPosition="start" />
            {writeAccess && <Tab value="invoices" label="Invoices" icon={<Receipt size={16} />} iconPosition="start" />}
            {writeAccess && <Tab value="usage" label="Usage history" icon={<History size={16} />} iconPosition="start" />}
          </Tabs>

          {tab === 'components' && (
            <>
              <TextField size="small" value={keyword} onChange={(e) => setKeyword(e.target.value)}
                placeholder="Search only this project's components — name, value, part number…"
                sx={{ mb: 2, width: { xs: '100%', sm: 460 } }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search size={16} color={colors.textMuted} /></InputAdornment> }} />
              {searching && rows.length > 0 && rows.every((r) => r.searchMatch) && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Nothing in this project is named exactly “{debouncedKeyword.trim()}” — showing its closest components.
                </Alert>
              )}
              <DataTable
                columns={columns} rows={rows} rowKey="componentId" minWidth={900}
                emptyState={{
                  icon: FolderOpen,
                  title: searching ? 'Nothing in this project matches' : 'This project folder is empty',
                  description: searching
                    ? 'The search only looks inside this project. Search the main Components page to find everything.'
                    : 'Add the components bought for this project, or scan its invoice — they stay in the main inventory too, marked with this project.',
                  actionLabel: !searching && writeAccess ? 'Add component' : undefined,
                  onAction: !searching && writeAccess ? () => setAddOpen(true) : undefined,
                }}
                renderActions={(r) => (
                  <Box sx={{ display: 'inline-flex', gap: 0.5 }}>
                    {writeAccess && (
                      <Tooltip title="Record usage">
                        <span>
                          <IconButton size="small" sx={{ color: colors.primary }} disabled={r.inStock < 1} onClick={() => setUsageRow(r)}>
                            <PackageMinus size={16} />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                    {writeAccess && (
                      <Tooltip title={r.remaining > 0 ? 'Move to another project' : 'Nothing left in this project to move'}>
                        <span>
                          <IconButton size="small" sx={{ color: colors.accent }} disabled={r.remaining < 1} onClick={() => setTransferRow(r)}>
                            <ArrowRightLeft size={16} />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                    <Tooltip title="Where these units came from">
                      <span>
                        <IconButton size="small" disabled={!r.entries.length} onClick={() => setEntriesRow(r)}><History size={16} /></IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Open in main inventory">
                      <IconButton size="small" onClick={() => navigate(`/components?q=${encodeURIComponent(r.componentName)}`)}>
                        <Boxes size={16} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              />
            </>
          )}

          {tab === 'invoices' && (
            purchases === null ? <CircularProgress size={22} /> : purchases.length === 0 ? (
              <Alert severity="info" action={<Button size="small" onClick={openInvoice}>Scan invoice</Button>}>
                No invoices recorded for this project yet. Invoices scanned here are linked to the project and fill its folder.
              </Alert>
            ) : (
              <DataTable
                rowKey="id" rows={purchases} minWidth={640}
                columns={[
                  { field: 'purchaseDate', headerName: 'Date', render: (p) => dateLabel(p.purchaseDate) },
                  { field: 'invoiceNumber', headerName: 'Invoice', render: (p) => <b>{p.invoiceNumber}</b> },
                  { field: 'supplierName', headerName: 'Supplier' },
                  { field: 'items', headerName: 'Lines', align: 'right', render: (p) => p.items?.length ?? 0 },
                  { field: 'totalAmount', headerName: 'Total', align: 'right', render: (p) => <b>{formatCurrency(p.totalAmount)}</b> },
                ]}
                renderActions={(p) => <Button size="small" onClick={() => setPurchaseRow(p)}>Details</Button>}
              />
            )
          )}

          {tab === 'usage' && (
            usage === null ? <CircularProgress size={22} /> : usage.length === 0 ? (
              <Alert severity="info">Nothing used in this project yet. Use the <b>Record usage</b> button on a component.</Alert>
            ) : (
              <DataTable
                rowKey="id" rows={usage} minWidth={600}
                columns={[
                  { field: 'usageDate', headerName: 'Date', render: (u) => dateLabel(u.usageDate) },
                  { field: 'componentName', headerName: 'Component', render: (u) => <b>{u.componentName}</b> },
                  { field: 'quantityUsed', headerName: 'Qty', align: 'right' },
                  { field: 'remarks', headerName: 'Remarks' },
                ]}
              />
            )
          )}
        </>
      )}

      {project && (
        <>
          <AddComponentDialog open={addOpen} onClose={() => setAddOpen(false)} project={project} notify={notify}
            onAdded={(data, message) => { setAddOpen(false); setFolder(data); setKeyword(''); notify(message); }} />
          <UsageDialog open={!!usageRow} onClose={() => setUsageRow(null)} project={project} row={usageRow}
            onDone={(message) => { setUsageRow(null); notify(message); refreshAll(); }} />
          <TransferDialog open={!!transferRow} onClose={() => setTransferRow(null)} project={project} row={transferRow}
            onDone={(data, message) => { setTransferRow(null); setFolder(data); setKeyword(''); notify(message); }} />
          <InvoiceUploadDialog
            open={invoiceOpen} onClose={() => setInvoiceOpen(false)} components={allComponents}
            projectId={project.id} projectName={project.projectName}
            onCreated={(message) => { setInvoiceOpen(false); notify(message); refreshAll(); }}
          />
        </>
      )}

      <Dialog open={!!entriesRow} onClose={() => setEntriesRow(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{entriesRow?.componentName}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.8125rem', color: colors.textSecondary, mb: 1.5 }}>
            How these units came into the project. Releasing an entry keeps the units in the inventory —
            they simply stop belonging to this project.
          </Typography>
          {entriesRow?.entries.map((e) => (
            <Box key={e.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderTop: `1px solid ${colors.border}` }}>
              <SourceChip source={e.source} />
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                  {e.quantity} × {e.unitPrice != null ? formatCurrency(e.unitPrice) : '—'}
                  {e.invoiceNumber ? ` · Invoice ${e.invoiceNumber}` : ''}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted }}>
                  {dateLabel(e.createdAt)}{e.createdBy ? ` · ${e.createdBy}` : ''}{e.notes ? ` · ${e.notes}` : ''}
                </Typography>
              </Box>
              {writeAccess && (
                <Tooltip title="Release to general stock">
                  <IconButton size="small" sx={{ color: colors.danger }} onClick={() => setReleaseEntry(e)}><Trash2 size={15} /></IconButton>
                </Tooltip>
              )}
            </Box>
          ))}
        </DialogContent>
        <DialogActions><Button onClick={() => setEntriesRow(null)}>Close</Button></DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!releaseEntry} title="Release from project"
        message={releaseEntry ? `Take ${releaseEntry.quantity} units out of this project? They stay in the inventory as general stock.` : ''}
        confirmText="Release"
        onCancel={() => setReleaseEntry(null)}
        onConfirm={async () => {
          try {
            const res = await releaseProjectEntry(projectId, releaseEntry.id);
            setFolder(res.data);
            setEntriesRow(null);
            notify('Released to general stock');
          } catch (err) {
            notify(err.response?.data?.message || 'Could not release', 'error');
          } finally {
            setReleaseEntry(null);
          }
        }}
      />

      <PurchaseDetailsDrawer
        open={Boolean(purchaseRow)} purchase={purchaseRow} onClose={() => setPurchaseRow(null)}
        onViewInvoice={(p) => downloadInvoice(p.id, p.invoiceFileOriginalName).catch(() => notify('Could not open the invoice', 'error'))}
        onDownloadInvoice={(p) => downloadInvoice(p.id, p.invoiceFileOriginalName).catch(() => notify('Could not download the invoice', 'error'))}
      />

      <Snackbar open={snack.open} autoHideDuration={4500} onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack({ ...snack, open: false })}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default ProjectWorkspacePage;
