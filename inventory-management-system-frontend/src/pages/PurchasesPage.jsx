import { useCallback, useEffect, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, TextField, Typography, Snackbar, Alert, Grid, Divider, Tooltip,
} from '@mui/material';
import { Plus, Trash2, Upload, FileCheck2, ShoppingCart } from 'lucide-react';
import {
  getPurchases, searchPurchases, createPurchase, deletePurchase, uploadInvoice,
} from '../api/purchaseApi';
import { getComponents } from '../api/componentApi';
import DataTable from '../components/common/DataTable';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { PageHeader, StatusBadge, SearchBar } from '../components/ui';
import { colors } from '../theme/tokens';

const emptyItem = { componentId: '', quantity: 1, unitPrice: 0 };
const emptyForm = {
  supplierName: '', invoiceNumber: '', purchaseDate: '', remarks: '', items: [{ ...emptyItem }],
};

import { formatCurrency as currency, CURRENCY_SYMBOL } from '../utils/currency';


const PurchasesPage = () => {
  const [rows, setRows] = useState([]);
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, size, sortBy: 'purchaseDate', sortDir: 'desc' };
      const res = keyword.trim()
        ? await searchPurchases({ ...params, keyword: keyword.trim() })
        : await getPurchases(params);
      setRows(res.data?.content || []);
      setTotal(res.data?.totalElements || 0);
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Failed to load purchases', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, size, keyword]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    getComponents({ page: 0, size: 500 }).then((r) => setComponents(r.data?.content || []));
  }, []);

  const updateItem = (index, field, value) => {
    const items = [...form.items];
    items[index] = { ...items[index], [field]: value };
    setForm({ ...form, items });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { ...emptyItem }] });
  const removeItem = (index) => setForm({ ...form, items: form.items.filter((_, i) => i !== index) });

  const handleSave = async () => {
    try {
      const payload = {
        ...form,
        items: form.items.map((item) => ({
          componentId: Number(item.componentId),
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      };
      await createPurchase(payload);
      setSnack({ open: true, message: 'Purchase created', severity: 'success' });
      setDialogOpen(false);
      setForm(emptyForm);
      fetchData();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Create failed', severity: 'error' });
    }
  };

  const handleDelete = async () => {
    try {
      await deletePurchase(deleteId);
      setSnack({ open: true, message: 'Purchase deleted', severity: 'success' });
      setDeleteId(null);
      fetchData();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Delete failed', severity: 'error' });
    }
  };

  const handleUpload = async (purchaseId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadInvoice(purchaseId, file);
      setSnack({ open: true, message: 'Invoice uploaded', severity: 'success' });
      fetchData();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Upload failed', severity: 'error' });
    }
    e.target.value = '';
  };

  const estimatedTotal = form.items.reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.unitPrice || 0), 0);

  const columns = [
    { field: 'supplierName', headerName: 'Supplier' },
    { field: 'invoiceNumber', headerName: 'Invoice #' },
    { field: 'purchaseDate', headerName: 'Date' },
    { field: 'totalAmount', headerName: 'Total', align: 'right', render: (row) => <Box component="span" sx={{ fontWeight: 600 }}>{currency(row.totalAmount)}</Box> },
    {
      field: 'invoiceFilePath', headerName: 'Invoice',
      render: (row) => row.invoiceFilePath
        ? <StatusBadge status="completed" label="Uploaded" />
        : <StatusBadge status="pending" label="Missing" />,
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Purchases"
        subtitle="Create purchase orders, attach invoices, and track procurement."
        icon={ShoppingCart}
        breadcrumbs={[{ label: 'Procurement' }, { label: 'Purchases' }]}
        actions={
          <>
            <SearchBar
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search purchases…"
              width={220}
              sx={{ display: { xs: 'none', sm: 'flex' } }}
            />
            <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => { setForm(emptyForm); setDialogOpen(true); }}>
              New Purchase
            </Button>
          </>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        page={page}
        rowsPerPage={size}
        totalElements={total}
        onPageChange={setPage}
        onRowsPerPageChange={(s) => { setSize(s); setPage(0); }}
        emptyState={{
          icon: ShoppingCart,
          title: 'No purchases yet',
          description: 'Record your first purchase order to start tracking procurement.',
          actionLabel: 'New Purchase',
          onAction: () => { setForm(emptyForm); setDialogOpen(true); },
        }}
        renderActions={(row) => (
          <Box sx={{ display: 'inline-flex', gap: 0.5 }}>
            <Tooltip title="Upload invoice">
              <IconButton size="small" component="label">
                {row.invoiceFilePath ? <FileCheck2 size={17} color={colors.success} /> : <Upload size={17} />}
                <input type="file" hidden onChange={(e) => handleUpload(row.id, e)} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" sx={{ color: colors.danger }} onClick={() => setDeleteId(row.id)}><Trash2 size={17} /></IconButton>
            </Tooltip>
          </Box>
        )}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Purchase</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField label="Supplier Name" fullWidth required value={form.supplierName}
                onChange={(e) => setForm({ ...form, supplierName: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Invoice Number" fullWidth required value={form.invoiceNumber}
                onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Purchase Date" type="date" fullWidth InputLabelProps={{ shrink: true }}
                value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Remarks" fullWidth value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </Grid>
          </Grid>
          <Divider sx={{ my: 2.5 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="subtitle2">Line Items</Typography>
            <Typography variant="body2" color="text.secondary">
              Estimated total: <Box component="span" sx={{ fontWeight: 700, color: colors.textPrimary }}>{currency(estimatedTotal)}</Box>
            </Typography>
          </Box>
          {form.items.map((item, index) => (
            <Grid container spacing={1.5} key={index} sx={{ mb: 1.5 }} alignItems="center">
              <Grid item xs={12} sm={5}>
                <TextField select label="Component" fullWidth size="small" value={item.componentId}
                  onChange={(e) => updateItem(index, 'componentId', e.target.value)}>
                  {components.map((c) => <MenuItem key={c.id} value={c.id}>{c.componentName}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={6} sm={2}>
                <TextField label="Qty" type="number" fullWidth size="small" value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', e.target.value)} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField label={`Unit Price (${CURRENCY_SYMBOL})`} type="number" fullWidth size="small" value={item.unitPrice}
                  onChange={(e) => updateItem(index, 'unitPrice', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={2}>
                <Button color="error" size="small" startIcon={<Trash2 size={15} />} onClick={() => removeItem(index)} disabled={form.items.length === 1}>
                  Remove
                </Button>
              </Grid>
            </Grid>
          ))}
          <Button size="small" startIcon={<Plus size={15} />} onClick={addItem}>Add Item</Button>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>Create</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Purchase"
        message="Are you sure you want to delete this purchase?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack({ ...snack, open: false })}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default PurchasesPage;
