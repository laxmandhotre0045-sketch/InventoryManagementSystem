import { useCallback, useEffect, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Grid, MenuItem, TextField, Snackbar, Alert,
} from '@mui/material';
import { ArrowDownToLine, ArrowUpFromLine, Boxes } from 'lucide-react';
import { stockIn, stockOut, getTransactionHistory } from '../api/inventoryApi';
import { getComponents } from '../api/componentApi';
import DataTable from '../components/common/DataTable';
import { PageHeader, StatusBadge } from '../components/ui';

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
      field: 'transactionType', headerName: 'Type',
      render: (row) => <StatusBadge status={row.transactionType === 'STOCK_IN' ? 'stock_in' : 'stock_out'} />,
    },
    { field: 'componentName', headerName: 'Component' },
    { field: 'quantity', headerName: 'Quantity', align: 'right', render: (row) => <Box component="span" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{Number(row.quantity).toLocaleString()}</Box> },
    { field: 'createdBy', headerName: 'By' },
    { field: 'remarks', headerName: 'Remarks' },
  ];

  return (
    <Box>
      <PageHeader
        title="Inventory Transactions"
        subtitle="Record stock movements and review the full transaction history."
        icon={Boxes}
        breadcrumbs={[{ label: 'Manage' }, { label: 'Inventory' }]}
        actions={
          <>
            <Button variant="contained" color="success" startIcon={<ArrowDownToLine size={18} />} onClick={() => openDialog('IN')}>
              Stock In
            </Button>
            <Button variant="contained" color="warning" startIcon={<ArrowUpFromLine size={18} />} onClick={() => openDialog('OUT')}>
              Stock Out
            </Button>
          </>
        }
      />

      <DataTable
        columns={columns}
        rows={history}
        loading={loading}
        page={page}
        rowsPerPage={size}
        totalElements={total}
        onPageChange={setPage}
        onRowsPerPageChange={(s) => { setSize(s); setPage(0); }}
        emptyState={{
          icon: Boxes,
          title: 'No transactions yet',
          description: 'Record a stock-in or stock-out movement to get started.',
          actionLabel: 'Stock In',
          onAction: () => openDialog('IN'),
        }}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{dialogType === 'IN' ? 'Stock In' : 'Stock Out'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField select label="Component" fullWidth required value={form.componentId}
                onChange={(e) => setForm({ ...form, componentId: e.target.value })}>
                {components.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.componentName} (qty: {c.quantity})</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField label="Quantity" type="number" fullWidth required inputProps={{ min: 1 }}
                value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Remarks" fullWidth multiline rows={2}
                value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color={dialogType === 'IN' ? 'success' : 'warning'} onClick={handleSubmit}>Submit</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack({ ...snack, open: false })}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default InventoryPage;
