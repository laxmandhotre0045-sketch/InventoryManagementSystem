import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Button, Card, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, TextField, MenuItem, Snackbar, Alert, Grid, Tooltip, Chip, InputAdornment,
} from '@mui/material';
import { Plus, Pencil, Trash2, RotateCcw, Filter, X, AlertTriangle, CircuitBoard, Search } from 'lucide-react';
import {
  getComponents, createComponent, updateComponent, deleteComponent, restoreComponent, getLowStockComponents,
} from '../api/componentApi';
import { useAuth } from '../auth/AuthContext';
import { canWrite } from '../utils/roleUtils';
import DataTable from '../components/common/DataTable';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { PageHeader, StatusBadge } from '../components/ui';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { colors } from '../theme/tokens';

const emptyForm = {
  componentName: '', category: '', quantity: 0, minimumQuantity: 0, unit: '', location: '',
  status: 'ACTIVE', description: '',
};

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'DISCONTINUED', label: 'Discontinued' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const stockStatusOf = (row) => {
  if (row.quantity === 0) return 'out_of_stock';
  if (row.quantity <= row.minimumQuantity) return 'low_stock';
  return 'available';
};

const ComponentsPage = () => {
  const { role } = useAuth();
  const writeAccess = canWrite(role);
  // The navbar's global search lands here as ?q=… — seed the filter from it.
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState(() => searchParams.get('q') || '');
  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [stockStatus, setStockStatus] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page, size, sortBy: 'componentName', sortDir: 'asc',
        keyword: debouncedKeyword.trim(), category, status, stockStatus,
      };
      // API responses are wrapped in an ApiResponse envelope: { success, message, data }.
      // The paged payload lives at res.data.{content,totalElements}.
      const res = await getComponents(params);
      setRows(res.data?.content || []);
      setTotal(res.data?.totalElements || 0);
      const ls = await getLowStockComponents();
      setLowStock(ls.data || []);
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Failed to load components', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, size, debouncedKeyword, category, status, stockStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);
  // Reset to the first page whenever the (debounced) search term changes.
  useEffect(() => { setPage(0); }, [debouncedKeyword]);

  // Pick up a term handed over by the navbar's global search, including when this
  // page is already mounted. The param is consumed so a later manual edit to the
  // field isn't overwritten and the URL stays clean.
  const queryParam = searchParams.get('q');
  useEffect(() => {
    if (queryParam === null) return;
    setKeyword(queryParam);
    setSearchParams({}, { replace: true });
  }, [queryParam, setSearchParams]);

  const openCreate = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (row) => {
    setEditId(row.id);
    setForm({
      itemCode: row.itemCode || '',
      componentName: row.componentName || '', category: row.category || '',
      quantity: row.quantity ?? 0, minimumQuantity: row.minimumQuantity ?? 0,
      unit: row.unit || '', location: row.location || '',
      status: row.status || 'ACTIVE', description: row.description || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      // itemCode is system-generated — never sent to the API.
      const payload = { ...form, quantity: Number(form.quantity), minimumQuantity: Number(form.minimumQuantity) };
      delete payload.itemCode;
      if (editId) {
        await updateComponent(editId, payload);
        setSnack({ open: true, message: 'Component updated', severity: 'success' });
      } else {
        await createComponent(payload);
        setSnack({ open: true, message: 'Component created', severity: 'success' });
      }
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Save failed', severity: 'error' });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteComponent(deleteId);
      setSnack({ open: true, message: 'Component archived successfully', severity: 'success' });
      setDeleteId(null);
      fetchData();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Delete failed', severity: 'error' });
    }
  };

  const handleRestore = async (id) => {
    try {
      await restoreComponent(id);
      setSnack({ open: true, message: 'Component restored successfully', severity: 'success' });
      fetchData();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Restore failed', severity: 'error' });
    }
  };

  const resetFilters = () => {
    setKeyword(''); setCategory(''); setStatus(''); setStockStatus(''); setPage(0);
  };

  const columns = [
    {
      field: 'itemCode', headerName: 'Code',
      render: (row) => (
        <Box component="span" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: colors.primary, whiteSpace: 'nowrap' }}>
          {row.itemCode || '—'}
        </Box>
      ),
    },
    { field: 'componentName', headerName: 'Name' },
    { field: 'category', headerName: 'Category', render: (row) => row.category || <Box component="span" sx={{ color: colors.textMuted }}>—</Box> },
    {
      field: 'quantity', headerName: 'Quantity', align: 'right',
      render: (row) => (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.75 }}>
          {row.quantity <= row.minimumQuantity && (
            <Tooltip title="At or below minimum">
              <Box component="span" sx={{ display: 'inline-flex', color: colors.warning }}>
                <AlertTriangle size={16} />
              </Box>
            </Tooltip>
          )}
          <Box component="span" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{row.quantity.toLocaleString()}</Box>
        </Box>
      ),
    },
    { field: 'minimumQuantity', headerName: 'Min Qty', align: 'right', render: (row) => <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>{row.minimumQuantity.toLocaleString()}</Box> },
    { field: 'unit', headerName: 'Unit' },
    { field: 'stock', headerName: 'Stock', render: (row) => <StatusBadge status={stockStatusOf(row)} /> },
    {
      field: 'status', headerName: 'Status',
      render: (row) => (
        <StatusBadge status={row.status === 'ARCHIVED' ? 'cancelled' : 'active'} label={row.status || 'ACTIVE'} />
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Components"
        subtitle="Track parts, stock levels, and reorder thresholds."
        icon={CircuitBoard}
        breadcrumbs={[{ label: 'Manage' }, { label: 'Components' }]}
        actions={
          <>
            {lowStock.length > 0 && (
              <Chip
                icon={<AlertTriangle size={15} />}
                label={`${lowStock.length} low stock`}
                sx={{ bgcolor: colors.warningSoft, color: colors.warning, fontWeight: 600, '& .MuiChip-icon': { color: colors.warning } }}
              />
            )}
            <Button variant="contained" startIcon={<Plus size={18} />} onClick={openCreate} disabled={!writeAccess}>
              Add Component
            </Button>
          </>
        }
      />

      <Card sx={{ p: 2.5, mb: 4 }}>
        <Grid container spacing={2.5} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField label="Search components" size="small" fullWidth value={keyword}
              placeholder="Code, name, category, location…"
              onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchData()}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search size={17} color={colors.textMuted} /></InputAdornment> }} />
          </Grid>
          <Grid item xs={12} sm={6} md={2.5}>
            <TextField label="Category" size="small" fullWidth value={category}
              onChange={(e) => setCategory(e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField label="Status" size="small" fullWidth select value={status}
              onChange={(e) => setStatus(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="ACTIVE">Active</MenuItem>
              <MenuItem value="INACTIVE">Inactive</MenuItem>
              <MenuItem value="DISCONTINUED">Discontinued</MenuItem>
              <MenuItem value="ARCHIVED">Archived</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField label="Stock" size="small" fullWidth select value={stockStatus}
              onChange={(e) => setStockStatus(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="AVAILABLE">Available</MenuItem>
              <MenuItem value="LOW_STOCK">Low Stock</MenuItem>
              <MenuItem value="OUT_OF_STOCK">Out of Stock</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={2.5} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 1.25 }}>
            <Button variant="contained" startIcon={<Filter size={17} />} onClick={() => { setPage(0); fetchData(); }}>Apply</Button>
            <Button variant="text" startIcon={<X size={17} />} onClick={resetFilters}>Reset</Button>
          </Grid>
        </Grid>
      </Card>

      <DataTable
        columns={columns} rows={rows} loading={loading} page={page} rowsPerPage={size}
        totalElements={total} onPageChange={setPage} onRowsPerPageChange={(s) => { setSize(s); setPage(0); }}
        emptyState={{
          icon: CircuitBoard,
          title: 'No components found',
          description: 'Add your first component or adjust your filters to see results.',
          actionLabel: writeAccess ? 'Add Component' : undefined,
          onAction: writeAccess ? openCreate : undefined,
        }}
        renderActions={(row) => (
          <Box sx={{ display: 'inline-flex', gap: 0.875 }}>
            <Tooltip title="Edit">
              <span>
                <IconButton size="small" onClick={() => openEdit(row)} disabled={!writeAccess}><Pencil size={18} /></IconButton>
              </span>
            </Tooltip>
            {row.status === 'ARCHIVED' ? (
              <Tooltip title="Restore">
                <IconButton size="small" sx={{ color: colors.primary }} onClick={() => handleRestore(row.id)}><RotateCcw size={18} /></IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="Archive">
                <span>
                  <IconButton size="small" sx={{ color: colors.danger }} onClick={() => setDeleteId(row.id)} disabled={!writeAccess}><Trash2 size={18} /></IconButton>
                </span>
              </Tooltip>
            )}
          </Box>
        )}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? 'Edit Component' : 'Add Component'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                label="Item Code" fullWidth disabled
                value={editId ? (form.itemCode || '—') : 'Generated automatically on save'}
                helperText="System-generated and cannot be edited."
              />
            </Grid>
            <Grid item xs={12}><TextField label="Component Name" fullWidth required value={form.componentName}
              onChange={(e) => setForm({ ...form, componentName: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField label="Category" fullWidth value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField label="Unit" fullWidth value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField label="Warehouse Location" fullWidth placeholder="e.g. Rack A-12 / Bin 04"
              value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}>
              <TextField select label="Status" fullWidth value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUS_OPTIONS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}><TextField label="Quantity" type="number" fullWidth required value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField label="Minimum Quantity" type="number" fullWidth required value={form.minimumQuantity}
              onChange={(e) => setForm({ ...form, minimumQuantity: e.target.value })} /></Grid>
            <Grid item xs={12}><TextField label="Description" fullWidth multiline rows={2} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>Save</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteId} title="Archive Component"
        message="This component may have stock or project history. Archiving will hide it from new transactions while preserving existing records."
        onConfirm={handleDelete} onCancel={() => setDeleteId(null)} confirmText="Archive" />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack({ ...snack, open: false })}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default ComponentsPage;
