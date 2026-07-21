import { useCallback, useEffect, useState } from 'react';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, TextField, Typography, Snackbar, Alert, Grid,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import {
  getEquipment, searchEquipment, createEquipment, updateEquipment, deleteEquipment,
} from '../api/equipmentApi';
import { useAuth } from '../auth/AuthContext';
import { canWrite } from '../utils/roleUtils';
import DataTable from '../components/common/DataTable';
import ConfirmDialog from '../components/common/ConfirmDialog';

const emptyForm = {
  name: '', serialNumber: '', category: '', manufacturer: '',
  purchaseDate: '', warrantyExpiry: '', status: 'ACTIVE', location: '', notes: '',
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
      const res = keyword.trim()
        ? await searchEquipment({ ...params, keyword: keyword.trim() })
        : await getEquipment(params);
      setRows(res?.content || []);
      setTotal(res?.totalElements || 0);
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Failed to load equipment', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, size, keyword, category, status]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (row) => {
    setEditId(row.id);
    setForm({
      name: row.name || '', serialNumber: row.serialNumber || '', category: row.category || '',
      manufacturer: row.manufacturer || '', purchaseDate: row.purchaseDate || '',
      warrantyExpiry: row.warrantyExpiry || '', status: row.status || 'ACTIVE',
      location: row.location || '', notes: row.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editId) {
        await updateEquipment(editId, form);
        setSnack({ open: true, message: 'Equipment updated', severity: 'success' });
      } else {
        await createEquipment(form);
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

  const columns = [
    { field: 'name', headerName: 'Name' },
    { field: 'serialNumber', headerName: 'Serial #' },
    { field: 'category', headerName: 'Category' },
    {
      field: 'status', headerName: 'Status', render: (row) => (
        <Chip
          label={row.status || 'UNKNOWN'}
          size="small"
          color={row.status === 'ACTIVE' ? 'success' : row.status === 'INACTIVE' ? 'warning' : 'default'}
        />
      ),
    },
    { field: 'location', headerName: 'Location' },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5">Equipment</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} disabled={!writeAccess}>Add Equipment</Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Search" size="small" fullWidth value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchData()}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField label="Category" size="small" fullWidth value={category}
            onChange={(e) => setCategory(e.target.value)} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField label="Status" size="small" fullWidth select SelectProps={{ native: true }} value={status}
            onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="RETIRED">Retired</option>
          </TextField>
        </Grid>
        <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button variant="outlined" startIcon={<SearchIcon />} onClick={() => { setPage(0); fetchData(); }}>Apply</Button>
          <Button variant="text" onClick={() => { setKeyword(''); setCategory(''); setStatus(''); setPage(0); fetchData(); }}>Reset</Button>
        </Grid>
      </Grid>

      <DataTable
        columns={columns} rows={rows} loading={loading} page={page} rowsPerPage={size}
        totalElements={total} onPageChange={setPage} onRowsPerPageChange={(s) => { setSize(s); setPage(0); }}
        renderActions={writeAccess ? (row) => (
          <>
            <IconButton size="small" onClick={() => openEdit(row)}><EditIcon fontSize="small" /></IconButton>
            <IconButton size="small" color="error" onClick={() => setDeleteId(row.id)}><DeleteIcon fontSize="small" /></IconButton>
          </>
        ) : undefined}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? 'Edit Equipment' : 'Add Equipment'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            {['name', 'serialNumber', 'category', 'manufacturer', 'status', 'location'].map((field) => (
              <Grid item xs={12} sm={6} key={field}>
                <TextField
                  label={field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                  fullWidth required={field === 'name'}
                  value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                />
              </Grid>
            ))}
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
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>Save</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId} title="Delete Equipment"
        message="Are you sure you want to delete this equipment?"
        onConfirm={handleDelete} onCancel={() => setDeleteId(null)}
      />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert severity={snack.severity}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default EquipmentPage;
