import { useCallback, useEffect, useState } from 'react';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, TextField, Typography, Snackbar, Alert, Grid,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ReplayIcon from '@mui/icons-material/Replay';
import SearchIcon from '@mui/icons-material/Search';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  getComponents, createComponent, updateComponent, deleteComponent, restoreComponent, getLowStockComponents,
} from '../api/componentApi';
import { useAuth } from '../auth/AuthContext';
import { canWrite } from '../utils/roleUtils';
import DataTable from '../components/common/DataTable';
import ConfirmDialog from '../components/common/ConfirmDialog';

const emptyForm = {
  componentName: '', category: '', quantity: 0, minimumQuantity: 0, unit: '', description: '',
};

const ComponentsPage = () => {
  const { role } = useAuth();
  const writeAccess = canWrite(role);
  const [rows, setRows] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
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
        page,
        size,
        sortBy: 'componentName',
        sortDir: 'asc',
        keyword: keyword.trim(),
        category,
        status,
        stockStatus,
      };
      const res = await getComponents(params);
      setRows(res?.content || []);
      setTotal(res?.totalElements || 0);
      const ls = await getLowStockComponents();
      setLowStock(ls || []);
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Failed to load components', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, size, keyword, category, status, stockStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (row) => {
    setEditId(row.id);
    setForm({
      componentName: row.componentName || '', category: row.category || '',
      quantity: row.quantity ?? 0, minimumQuantity: row.minimumQuantity ?? 0,
      unit: row.unit || '', description: row.description || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = { ...form, quantity: Number(form.quantity), minimumQuantity: Number(form.minimumQuantity) };
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

  const columns = [
    { field: 'componentName', headerName: 'Name' },
    { field: 'category', headerName: 'Category' },
    {
      field: 'quantity', headerName: 'Quantity',
      render: (row) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {row.quantity}
          {row.quantity <= row.minimumQuantity && (
            <WarningAmberIcon color="warning" fontSize="small" titleAccess="Low stock" />
          )}
        </Box>
      ),
    },
    { field: 'minimumQuantity', headerName: 'Min Qty' },
    { field: 'unit', headerName: 'Unit' },
    { field: 'status', headerName: 'Status', render: (row) => <Chip label={row.status || 'ACTIVE'} size="small" color={row.status === 'ARCHIVED' ? 'default' : 'primary'} /> },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5">Components</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          {lowStock.length > 0 && (
            <Chip icon={<WarningAmberIcon />} label={`${lowStock.length} low stock`} color="warning" size="small" />
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} disabled={!writeAccess}>Add Component</Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <TextField label="Search" size="small" fullWidth value={keyword}
            onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchData()} />
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
            <option value="DISCONTINUED">Discontinued</option>
            <option value="ARCHIVED">Archived</option>
          </TextField>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField label="Stock" size="small" fullWidth select SelectProps={{ native: true }} value={stockStatus}
            onChange={(e) => setStockStatus(e.target.value)}>
            <option value="">All</option>
            <option value="AVAILABLE">Available</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </TextField>
        </Grid>
        <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button variant="outlined" startIcon={<SearchIcon />} onClick={() => { setPage(0); fetchData(); }}>Apply</Button>
          <Button variant="text" onClick={() => {
            setKeyword(''); setCategory(''); setStatus(''); setStockStatus(''); setPage(0); fetchData();
          }}>Reset</Button>
        </Grid>
      </Grid>

      <DataTable
        columns={columns} rows={rows} loading={loading} page={page} rowsPerPage={size}
        totalElements={total} onPageChange={setPage} onRowsPerPageChange={(s) => { setSize(s); setPage(0); }}
        renderActions={(row) => (
          <>
            <IconButton size="small" onClick={() => openEdit(row)} disabled={!writeAccess}><EditIcon fontSize="small" /></IconButton>
            {row.status === 'ARCHIVED' ? (
              <IconButton size="small" color="primary" onClick={() => handleRestore(row.id)}>
                <ReplayIcon fontSize="small" />
              </IconButton>
            ) : (
              <IconButton size="small" color="error" onClick={() => setDeleteId(row.id)} disabled={!writeAccess}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
          </>
        )}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? 'Edit Component' : 'Add Component'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}><TextField label="Component Name" fullWidth required value={form.componentName}
              onChange={(e) => setForm({ ...form, componentName: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField label="Category" fullWidth value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField label="Unit" fullWidth value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField label="Quantity" type="number" fullWidth required value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField label="Minimum Quantity" type="number" fullWidth required value={form.minimumQuantity}
              onChange={(e) => setForm({ ...form, minimumQuantity: e.target.value })} /></Grid>
            <Grid item xs={12}><TextField label="Description" fullWidth multiline rows={2} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>Save</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteId} title="Archive Component"
        message="This component may have stock or project history. Archiving will hide it from new transactions while preserving existing records."
        onConfirm={handleDelete} onCancel={() => setDeleteId(null)} confirmText="Archive" />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert severity={snack.severity}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default ComponentsPage;
