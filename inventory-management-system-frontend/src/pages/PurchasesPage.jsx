import { useCallback, useEffect, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, TextField, Typography, Snackbar, Alert, Grid, Divider, Tooltip,
} from '@mui/material';
import { Plus, Trash2, Upload, FileCheck2, ShoppingCart, Sparkles, Eye, Download } from 'lucide-react';
import {
  getPurchases, searchPurchases, createPurchase, deletePurchase, uploadInvoice, downloadInvoice,
} from '../api/purchaseApi';
import { getComponents } from '../api/componentApi';
import DataTable from '../components/common/DataTable';
import ConfirmDialog from '../components/common/ConfirmDialog';
import InvoiceUploadDialog from '../components/purchases/InvoiceUploadDialog';
import InvoiceViewerDialog from '../components/purchases/InvoiceViewerDialog';
import { PageHeader, StatusBadge, SearchBar } from '../components/ui';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { colors } from '../theme/tokens';

const emptyItem = { componentId: '', quantity: 1, unitPrice: 0 };
const emptyForm = {
  supplierName: '', invoiceNumber: '', purchaseDate: '', remarks: '', items: [{ ...emptyItem }],
};

import { formatCurrency as currency, CURRENCY_SYMBOL } from '../utils/currency';

const dateLabel = (v) =>
  (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const PurchasesPage = () => {
  const [rows, setRows] = useState([]);
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [viewRow, setViewRow] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, size, sortBy: 'purchaseDate', sortDir: 'desc' };
      const res = debouncedKeyword.trim()
        ? await searchPurchases({ ...params, keyword: debouncedKeyword.trim() })
        : await getPurchases(params);
      setRows(res.data?.content || []);
      setTotal(res.data?.totalElements || 0);
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Failed to load purchases', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, size, debouncedKeyword]);

  useEffect(() => { fetchData(); }, [fetchData]);
  // A new search has to start from page 1 (see ProjectsPage).
  useEffect(() => { setPage(0); }, [debouncedKeyword]);
  useEffect(() => {
    getComponents({ page: 0, size: 500 }).then((r) => setComponents(r.data?.content || [])).catch(() => {});
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

  const handleDownload = async (row) => {
    try {
      await downloadInvoice(row.id, row.invoiceFileOriginalName);
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Could not download the invoice', severity: 'error' });
    }
  };

  const estimatedTotal = form.items.reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.unitPrice || 0), 0);

  const columns = [
    {
      field: 'invoiceNumber', headerName: 'Invoice #',
      render: (row) => (
        <Box component="span" sx={{ fontWeight: 600, color: colors.primary, whiteSpace: 'nowrap' }}>
          {row.invoiceNumber}
        </Box>
      ),
    },
    { field: 'supplierName', headerName: 'Supplier' },
    { field: 'purchaseDate', headerName: 'Invoice Date', render: (row) => dateLabel(row.purchaseDate) },
    { field: 'totalAmount', headerName: 'Total', align: 'right', render: (row) => <Box component="span" sx={{ fontWeight: 600 }}>{currency(row.totalAmount)}</Box> },
    {
      field: 'invoiceUploadedAt', headerName: 'Uploaded',
      render: (row) => (row.invoiceUploadedAt
        ? dateLabel(row.invoiceUploadedAt)
        : <Box component="span" sx={{ color: colors.textMuted }}>—</Box>),
    },
    {
      field: 'invoiceUploadedBy', headerName: 'Uploaded By',
      render: (row) => (row.invoiceUploadedBy
        ? <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{row.invoiceUploadedBy.split('@')[0]}</Box>
        : <Box component="span" sx={{ color: colors.textMuted }}>—</Box>),
    },
    {
      field: 'hasInvoice', headerName: 'Status',
      render: (row) => (row.hasInvoice
        ? <StatusBadge status="completed" label="Attached" />
        : <StatusBadge status="pending" label="Missing" />),
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
            <Button variant="outlined" startIcon={<Sparkles size={18} />} onClick={() => setOcrOpen(true)}>
              Upload Invoice
            </Button>
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => { setForm(emptyForm); setDialogOpen(true); }}>
              New Purchase
            </Button>
          </>
        }
      />

      <InvoiceUploadDialog
        open={ocrOpen}
        onClose={() => setOcrOpen(false)}
        components={components}
        onCreated={(message) => {
          setSnack({ open: true, message, severity: 'success' });
          fetchData();
          getComponents({ page: 0, size: 500 }).then((r) => setComponents(r.data?.content || []));
        }}
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
            <Tooltip title={row.hasInvoice ? 'View invoice' : 'No invoice uploaded yet'}>
              <span>
                <IconButton size="small" disabled={!row.hasInvoice} onClick={() => setViewRow(row)}>
                  <Eye size={16} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={row.hasInvoice ? 'Download invoice' : 'No invoice uploaded yet'}>
              <span>
                <IconButton size="small" disabled={!row.hasInvoice} onClick={() => handleDownload(row)}>
                  <Download size={16} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={row.hasInvoice ? 'Replace invoice' : 'Upload invoice'}>
              <IconButton size="small" component="label" sx={row.hasInvoice ? { color: colors.success } : undefined}>
                {row.hasInvoice ? <FileCheck2 size={16} /> : <Upload size={16} />}
                <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleUpload(row.id, e)} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" sx={{ color: colors.danger }} onClick={() => setDeleteId(row.id)}><Trash2 size={16} /></IconButton>
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

      <InvoiceViewerDialog
        open={!!viewRow}
        purchase={viewRow}
        onClose={() => setViewRow(null)}
      />

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
