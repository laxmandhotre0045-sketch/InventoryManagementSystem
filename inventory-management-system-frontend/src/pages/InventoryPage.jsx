import { useCallback, useEffect, useState } from 'react';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Grid, MenuItem, TextField, Typography, Snackbar, Alert,
} from '@mui/material';
import { stockIn, stockOut, getTransactionHistory } from '../api/inventoryApi';
import { getComponents } from '../api/componentApi';
import DataTable from '../components/common/DataTable';

const InventoryPage = () => {
  const [components, setComponents] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState({ componentId: '', quantity: 1, remarks: '' });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState('IN');
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const loadComponents = async () => {
    const res = await getComponents({ page: 0, size: 500 });
    setComponents(res.data?.content || []);
  };

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTransactionHistory({ page, size, sortBy: 'transactionDate', sortDir: 'desc' });
      setHistory(res.data?.content || []);
      setTotal(res.data?.totalElements || 0);
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Failed to load history', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, size]);

  useEffect(() => { loadComponents(); }, []);
  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const openDialog = (type) => {
    setDialogType(type);
    setForm({ componentId: '', quantity: 1, remarks: '' });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        componentId: Number(form.componentId),
        quantity: Number(form.quantity),
        remarks: form.remarks,
      };
      if (dialogType === 'IN') {
        await stockIn(payload);
        setSnack({ open: true, message: 'Stock IN recorded', severity: 'success' });
      } else {
        await stockOut(payload);
        setSnack({ open: true, message: 'Stock OUT recorded', severity: 'success' });
      }
      setDialogOpen(false);
      fetchHistory();
      loadComponents();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Transaction failed', severity: 'error' });
    }
  };

  const columns = [
    { field: 'transactionDate', headerName: 'Date' },
    {
      field: 'transactionType',
      headerName: 'Type',
      render: (row) => (
        <Chip
          label={row.transactionType}
          size="small"
          color={row.transactionType === 'STOCK_IN' ? 'success' : 'warning'}
        />
      ),
    },
    { field: 'componentName', headerName: 'Component' },
    { field: 'quantity', headerName: 'Quantity' },
    { field: 'createdBy', headerName: 'By' },
    { field: 'remarks', headerName: 'Remarks' },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Inventory Transactions</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" color="success" onClick={() => openDialog('IN')}>Stock IN</Button>
          <Button variant="contained" color="warning" onClick={() => openDialog('OUT')}>Stock OUT</Button>
        </Box>
      </Box>

      <DataTable
        columns={columns}
        rows={history}
        loading={loading}
        page={page}
        rowsPerPage={size}
        totalElements={total}
        onPageChange={setPage}
        onRowsPerPageChange={(s) => { setSize(s); setPage(0); }}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{dialogType === 'IN' ? 'Stock IN' : 'Stock OUT'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                select
                label="Component"
                fullWidth
                required
                value={form.componentId}
                onChange={(e) => setForm({ ...form, componentId: e.target.value })}
              >
                {components.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.componentName} (qty: {c.quantity})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Quantity"
                type="number"
                fullWidth
                required
                inputProps={{ min: 1 }}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Remarks"
                fullWidth
                multiline
                rows={2}
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}>Submit</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert severity={snack.severity}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default InventoryPage;
