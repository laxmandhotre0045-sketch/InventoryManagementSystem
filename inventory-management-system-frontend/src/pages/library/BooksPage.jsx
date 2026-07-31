import { useCallback, useEffect, useState } from 'react';
import {
  Box, Button, Card, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, TextField, MenuItem, Snackbar, Alert, Grid, Tooltip, InputAdornment,
  Divider, Typography,
} from '@mui/material';
import { Plus, Pencil, Trash2, Filter, X, BookOpen, Search, Eye } from 'lucide-react';
import {
  getBooks, createBook, updateBook, deleteBook, getBookCategories, getBook,
} from '../../api/library/bookApi';
import DataTable from '../../components/common/DataTable';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { PageHeader, StatusBadge } from '../../components/ui';
import { bookStatusBadge, availabilityBadge, formatDate } from '../../utils/libraryStatus';
import { colors } from '../../theme/tokens';

const emptyForm = {
  title: '', author: '', publisher: '', isbn: '', edition: '', category: '',
  language: '', shelfLocation: '', totalCopies: 1, status: 'ACTIVE', notes: '',
};

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const BooksPage = () => {
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editRow, setEditRow] = useState(null);
  const [viewRow, setViewRow] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const notify = (message, severity = 'success') => setSnack({ open: true, message, severity });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBooks({ page, size, sortBy: 'createdAt', sortDir: 'desc', keyword: keyword.trim(), category, status });
      setRows(res.data?.content || []);
      setTotal(res.data?.totalElements || 0);
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to load books', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, size, keyword, category, status]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    getBookCategories().then((res) => setCategories(res.data || [])).catch(() => {});
  }, []);

  const openCreate = () => { setEditRow(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (row) => {
    setEditRow(row);
    setForm({
      title: row.title || '', author: row.author || '', publisher: row.publisher || '',
      isbn: row.isbn || '', edition: row.edition || '', category: row.category || '',
      language: row.language || '', shelfLocation: row.shelfLocation || '',
      totalCopies: row.totalCopies ?? 1, status: row.status || 'ACTIVE', notes: row.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { notify('Title is required', 'error'); return; }
    setSaving(true);
    try {
      const payload = { ...form, totalCopies: Number(form.totalCopies) };
      if (editRow) {
        await updateBook(editRow.id, payload);
        notify('Book updated');
      } else {
        await createBook(payload);
        notify('Book created');
      }
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      notify(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteBook(deleteId);
      notify('Book deleted');
      setDeleteId(null);
      fetchData();
    } catch (err) {
      notify(err.response?.data?.message || 'Delete failed', 'error');
    }
  };

  const openView = async (row) => {
    try {
      const res = await getBook(row.id);
      setViewRow(res.data);
    } catch {
      setViewRow(row);
    }
  };

  const resetFilters = () => { setKeyword(''); setCategory(''); setStatus(''); setPage(0); };

  const columns = [
    {
      field: 'bookCode', headerName: 'Code',
      render: (row) => (
        <Box component="span" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: colors.primary, whiteSpace: 'nowrap' }}>
          {row.bookCode || '—'}
        </Box>
      ),
    },
    {
      field: 'title', headerName: 'Title',
      render: (row) => (
        <Box>
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600 }}>{row.title}</Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: colors.textMuted }}>{row.author || '—'}</Typography>
        </Box>
      ),
    },
    { field: 'category', headerName: 'Category', render: (row) => row.category || <Box component="span" sx={{ color: colors.textMuted }}>—</Box> },
    { field: 'shelfLocation', headerName: 'Shelf', render: (row) => row.shelfLocation || <Box component="span" sx={{ color: colors.textMuted }}>—</Box> },
    {
      field: 'copies', headerName: 'Copies', align: 'right',
      render: (row) => (
        <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          <Box component="span" sx={{ fontWeight: 700, color: row.availableCopies > 0 ? colors.success : colors.danger }}>{row.availableCopies}</Box>
          <Box component="span" sx={{ color: colors.textMuted }}> / {row.totalCopies}</Box>
        </Box>
      ),
    },
    { field: 'availability', headerName: 'Availability', render: (row) => <StatusBadge {...availabilityBadge(row.availability)} /> },
    { field: 'status', headerName: 'Status', render: (row) => <StatusBadge {...bookStatusBadge(row.status)} /> },
  ];

  return (
    <Box>
      <PageHeader
        title="Books"
        subtitle="Manage your library catalogue — titles, copies and shelf locations."
        icon={BookOpen}
        breadcrumbs={[{ label: 'Library' }, { label: 'Books' }]}
        actions={
          <Button variant="contained" startIcon={<Plus size={18} />} onClick={openCreate}>Add Book</Button>
        }
      />

      <Card sx={{ p: 2.5, mb: 4 }}>
        <Grid container spacing={2.5} alignItems="center">
          <Grid item xs={12} sm={6} md={3.5}>
            <TextField label="Search by code, title, author, ISBN" size="small" fullWidth value={keyword}
              placeholder="e.g. BK0001 or Clean Code"
              onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (setPage(0), fetchData())}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search size={17} color={colors.textMuted} /></InputAdornment> }} />
          </Grid>
          <Grid item xs={12} sm={6} md={2.5}>
            <TextField label="Category" size="small" fullWidth select value={category} onChange={(e) => setCategory(e.target.value)}>
              <MenuItem value="">All categories</MenuItem>
              {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={2.5}>
            <TextField label="Status" size="small" fullWidth select value={status} onChange={(e) => setStatus(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {STATUS_OPTIONS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} md={3.5} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 1.25 }}>
            <Button variant="contained" startIcon={<Filter size={17} />} onClick={() => { setPage(0); fetchData(); }}>Apply</Button>
            <Button variant="text" startIcon={<X size={17} />} onClick={resetFilters}>Reset</Button>
          </Grid>
        </Grid>
      </Card>

      <DataTable
        columns={columns} rows={rows} loading={loading} page={page} rowsPerPage={size}
        totalElements={total} onPageChange={setPage} onRowsPerPageChange={(s) => { setSize(s); setPage(0); }}
        emptyState={{
          icon: BookOpen,
          title: 'No books found',
          description: 'Add your first book or adjust your filters to see results.',
          actionLabel: 'Add Book',
          onAction: openCreate,
        }}
        renderActions={(row) => (
          <Box sx={{ display: 'inline-flex', gap: 0.875 }}>
            <Tooltip title="View"><IconButton size="small" onClick={() => openView(row)}><Eye size={18} /></IconButton></Tooltip>
            <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(row)}><Pencil size={18} /></IconButton></Tooltip>
            <Tooltip title="Delete"><IconButton size="small" sx={{ color: colors.danger }} onClick={() => setDeleteId(row.id)}><Trash2 size={18} /></IconButton></Tooltip>
          </Box>
        )}
      />

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editRow ? 'Edit Book' : 'Add Book'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField label="Book Code" fullWidth disabled
                value={editRow ? (editRow.bookCode || '—') : 'Generated automatically on save'}
                helperText="System-generated and cannot be edited." />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select label="Status" fullWidth value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUS_OPTIONS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12}><TextField label="Title" fullWidth required value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField label="Author" fullWidth value={form.author}
              onChange={(e) => setForm({ ...form, author: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField label="Publisher" fullWidth value={form.publisher}
              onChange={(e) => setForm({ ...form, publisher: e.target.value })} /></Grid>
            <Grid item xs={12} sm={4}><TextField label="ISBN" fullWidth value={form.isbn}
              onChange={(e) => setForm({ ...form, isbn: e.target.value })} /></Grid>
            <Grid item xs={12} sm={4}><TextField label="Edition" fullWidth value={form.edition}
              onChange={(e) => setForm({ ...form, edition: e.target.value })} /></Grid>
            <Grid item xs={12} sm={4}><TextField label="Language" fullWidth value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })} /></Grid>
            <Grid item xs={12} sm={4}><TextField label="Category" fullWidth value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })} /></Grid>
            <Grid item xs={12} sm={4}><TextField label="Shelf Location" fullWidth placeholder="e.g. A-12"
              value={form.shelfLocation} onChange={(e) => setForm({ ...form, shelfLocation: e.target.value })} /></Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Total Copies" type="number" fullWidth required value={form.totalCopies}
                inputProps={{ min: 1 }}
                onChange={(e) => setForm({ ...form, totalCopies: e.target.value })}
                helperText={editRow ? 'Available copies adjust automatically' : 'Available = total on creation'} />
            </Grid>
            <Grid item xs={12}><TextField label="Notes" fullWidth multiline rows={2} value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      {/* View dialog */}
      <Dialog open={!!viewRow} onClose={() => setViewRow(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Book Details</DialogTitle>
        <DialogContent>
          {viewRow && (
            <Box sx={{ pt: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box component="span" sx={{ fontWeight: 700, color: colors.primary }}>{viewRow.bookCode}</Box>
                <StatusBadge {...bookStatusBadge(viewRow.status)} />
                <StatusBadge {...availabilityBadge(viewRow.availability)} />
              </Box>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, mb: 0.25 }}>{viewRow.title}</Typography>
              <Typography sx={{ color: colors.textSecondary, mb: 2 }}>{viewRow.author || '—'}</Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={1.5}>
                {[
                  ['Publisher', viewRow.publisher], ['ISBN', viewRow.isbn], ['Edition', viewRow.edition],
                  ['Language', viewRow.language], ['Category', viewRow.category], ['Shelf Location', viewRow.shelfLocation],
                  ['Total Copies', viewRow.totalCopies], ['Available Copies', viewRow.availableCopies],
                  ['Issued Copies', viewRow.issuedCopies],
                  ['Created', formatDate(viewRow.createdAt)], ['Updated', formatDate(viewRow.updatedAt)],
                ].map(([label, value]) => (
                  <Grid item xs={6} key={label}>
                    <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</Typography>
                    <Typography sx={{ fontSize: '0.9375rem', fontWeight: 500 }}>{value ?? '—'}</Typography>
                  </Grid>
                ))}
                {viewRow.notes && (
                  <Grid item xs={12}>
                    <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Notes</Typography>
                    <Typography sx={{ fontSize: '0.9375rem' }}>{viewRow.notes}</Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setViewRow(null)}>Close</Button>
          <Button variant="contained" onClick={() => { openEdit(viewRow); setViewRow(null); }}>Edit</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteId} title="Delete Book"
        message="This will permanently remove the book from the catalogue. Books with copies currently issued cannot be deleted."
        onConfirm={handleDelete} onCancel={() => setDeleteId(null)} confirmText="Delete" />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack({ ...snack, open: false })}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default BooksPage;
