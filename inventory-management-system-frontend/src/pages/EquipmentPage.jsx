import { useCallback, useEffect, useState } from 'react';
import {
  Box, Button, Card, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, TextField, MenuItem, Snackbar, Alert, Grid, Tooltip, InputAdornment,
} from '@mui/material';
import { Plus, Pencil, Trash2, Filter, X, Cpu, Search } from 'lucide-react';
import {
  getEquipment, searchEquipment, createEquipment, updateEquipment, deleteEquipment,
} from '../api/equipmentApi';
import { useAuth } from '../auth/AuthContext';
import { canWrite } from '../utils/roleUtils';
import DataTable from '../components/common/DataTable';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { PageHeader, StatusBadge } from '../components/ui';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { colors } from '../theme/tokens';

const emptyForm = {
  name: '', serialNumber: '', category: '', manufacturer: '',
  purchaseDate: '', warrantyExpiry: '', status: 'ACTIVE', location: '', notes: '',
};

// Free-text fields in the add/edit dialog. `status` is deliberately NOT here — it
// maps to a backend enum, so it gets its own Select below.
const TEXT_FIELDS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'serialNumber', label: 'Serial Number' },
  { key: 'category', label: 'Category' },
  { key: 'manufacturer', label: 'Manufacturer' },
  { key: 'location', label: 'Location', placeholder: 'e.g. Lab 2 / Bench 4' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'RETIRED', label: 'Retired' },
];

const equipmentStatus = (s) => {
  switch (s) {
    case 'ACTIVE': return 'active';
    case 'INACTIVE': return 'pending';
    case 'MAINTENANCE': return 'maintenance';
    case 'RETIRED': return 'cancelled';
    default: return 'default';
  }
};

const EquipmentPage = () => {
  const { role } = useAuth();
  const writeAccess = canWrite(role);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, size, sortBy: 'name', sortDir: 'asc', category, status };
      // API responses are wrapped in an ApiResponse envelope: { success, message, data }.
      // The paged payload lives at res.data.{content,totalElements}.
      const res = debouncedKeyword.trim()
        ? await searchEquipment({ ...params, keyword: debouncedKeyword.trim() })
        : await getEquipment(params);
      setRows(res.data?.content || []);
      setTotal(res.data?.totalElements || 0);
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Failed to load equipment', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, size, debouncedKeyword, category, status]);

  useEffect(() => { fetchData(); }, [fetchData]);
  // Reset to the first page whenever the (debounced) search term changes.
  useEffect(() => { setPage(0); }, [debouncedKeyword]);

  const openCreate = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (row) => {
    setEditId(row.id);
    setForm({
      itemCode: row.itemCode || '',
      name: row.name || '', serialNumber: row.serialNumber || '', category: row.category || '',
      manufacturer: row.manufacturer || '', purchaseDate: row.purchaseDate || '',
      warrantyExpiry: row.warrantyExpiry || '', status: row.status || 'ACTIVE',
      location: row.location || '', notes: row.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      // itemCode is system-generated — never sent to the API.
      const payload = { ...form };
      delete payload.itemCode;
      if (editId) {
        await updateEquipment(editId, payload);
        setSnack({ open: true, message: 'Equipment updated', severity: 'success' });
      } else {
        await createEquipment(payload);
        setSnack({ open: true, message: 'Equipment created', severity: 'success' });
      }
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Save failed', severity: 'error' });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteEquipment(deleteId);
      setSnack({ open: true, message: 'Equipment deleted', severity: 'success' });
      setDeleteId(null);
      fetchData();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Delete failed', severity: 'error' });
    }
  };

  const resetFilters = () => { setKeyword(''); setCategory(''); setStatus(''); setPage(0); };

  const columns = [
    {
      field: 'itemCode', headerName: 'Code',
      render: (row) => (
        <Box component="span" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: colors.primary, whiteSpace: 'nowrap' }}>
          {row.itemCode || '—'}
        </Box>
      ),
    },
    { field: 'name', headerName: 'Name' },
    { field: 'serialNumber', headerName: 'Serial #' },
    { field: 'category', headerName: 'Category' },
    { field: 'status', headerName: 'Status', render: (row) => <StatusBadge status={equipmentStatus(row.status)} label={row.status || 'UNKNOWN'} /> },
    { field: 'location', headerName: 'Location' },
  ];

  return (
    <Box>
      <PageHeader
        title="Equipment"
        subtitle="Manage assets, serial numbers, and maintenance status."
        icon={Cpu}
        breadcrumbs={[{ label: 'Manage' }, { label: 'Equipment' }]}
        actions={
          <Button variant="contained" startIcon={<Plus size={18} />} onClick={openCreate} disabled={!writeAccess}>
            Add Equipment
          </Button>
        }
      />

      <Card sx={{ p: 2.5, mb: 4 }}>
        <Grid container spacing={2.5} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField label="Search equipment" size="small" fullWidth value={keyword}
              placeholder="Name, serial, category, location…"
              onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchData()}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search size={17} color={colors.textMuted} /></InputAdornment> }} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField label="Category" size="small" fullWidth value={category}
              onChange={(e) => setCategory(e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField label="Status" size="small" fullWidth select value={status}
              onChange={(e) => setStatus(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {STATUS_OPTIONS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} md={3} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 1.25 }}>
            <Button variant="contained" startIcon={<Filter size={17} />} onClick={() => { setPage(0); fetchData(); }}>Apply</Button>
            <Button variant="text" startIcon={<X size={17} />} onClick={resetFilters}>Reset</Button>
          </Grid>
        </Grid>
      </Card>

      <DataTable
        columns={columns} rows={rows} loading={loading} page={page} rowsPerPage={size}
        totalElements={total} onPageChange={setPage} onRowsPerPageChange={(s) => { setSize(s); setPage(0); }}
        emptyState={{
          icon: Cpu,
          title: 'No equipment found',
          description: 'Register your first asset or adjust your filters to see results.',
          actionLabel: writeAccess ? 'Add Equipment' : undefined,
          onAction: writeAccess ? openCreate : undefined,
        }}
        renderActions={writeAccess ? (row) => (
          <Box sx={{ display: 'inline-flex', gap: 0.875 }}>
            <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(row)}><Pencil size={18} /></IconButton></Tooltip>
            <Tooltip title="Delete"><IconButton size="small" sx={{ color: colors.danger }} onClick={() => setDeleteId(row.id)}><Trash2 size={18} /></IconButton></Tooltip>
          </Box>
        ) : undefined}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? 'Edit Equipment' : 'Add Equipment'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                label="Item Code" fullWidth disabled
                value={editId ? (form.itemCode || '—') : 'Generated automatically on save'}
                helperText="System-generated and cannot be edited."
              />
            </Grid>
            {TEXT_FIELDS.map((field) => (
              <Grid item xs={12} sm={6} key={field.key}>
                <TextField
                  label={field.label}
                  placeholder={field.placeholder}
                  fullWidth required={field.required}
                  value={form[field.key]} onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                />
              </Grid>
            ))}
            <Grid item xs={12} sm={6}>
              <TextField select label="Status" fullWidth value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUS_OPTIONS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Purchase Date" type="date" fullWidth InputLabelProps={{ shrink: true }}
                value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Warranty Expiry" type="date" fullWidth InputLabelProps={{ shrink: true }}
                value={form.warrantyExpiry} onChange={(e) => setForm({ ...form, warrantyExpiry: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Notes" fullWidth multiline rows={2}
                value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>Save</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId} title="Delete Equipment"
        message="Are you sure you want to delete this equipment?"
        onConfirm={handleDelete} onCancel={() => setDeleteId(null)}
      />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack({ ...snack, open: false })}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default EquipmentPage;
