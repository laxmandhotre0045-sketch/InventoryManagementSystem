import { useCallback, useEffect, useState } from 'react';
import {
  Box, Button, Card, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, TextField, Snackbar, Alert, Grid, Tooltip, InputAdornment, Typography, Chip,
} from '@mui/material';
import { Plus, Pencil, Trash2, Users, Search, History, X } from 'lucide-react';
import {
  getMembers, createMember, updateMember, deleteMember, getMemberHistory,
} from '../../api/library/memberApi';
import DataTable from '../../components/common/DataTable';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { PageHeader, StatusBadge } from '../../components/ui';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { issueBadge, formatDate } from '../../utils/libraryStatus';
import { colors } from '../../theme/tokens';

const emptyForm = { employeeId: '', name: '', department: '', email: '', phone: '' };

const MembersPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editRow, setEditRow] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [historyMember, setHistoryMember] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const notify = (message, severity = 'success') => setSnack({ open: true, message, severity });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMembers({ page, size, sortBy: 'name', sortDir: 'asc', keyword: debouncedKeyword.trim() });
      setRows(res.data?.content || []);
      setTotal(res.data?.totalElements || 0);
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to load members', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, size, debouncedKeyword]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(0); }, [debouncedKeyword]);

  const openCreate = () => { setEditRow(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (row) => {
    setEditRow(row);
    setForm({
      employeeId: row.employeeId || '', name: row.name || '', department: row.department || '',
      email: row.email || '', phone: row.phone || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.employeeId.trim() || !form.name.trim()) { notify('Employee ID and Name are required', 'error'); return; }
    setSaving(true);
    try {
      if (editRow) { await updateMember(editRow.id, form); notify('Member updated'); }
      else { await createMember(form); notify('Member created'); }
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
      await deleteMember(deleteId);
      notify('Member deleted');
      setDeleteId(null);
      fetchData();
    } catch (err) {
      notify(err.response?.data?.message || 'Delete failed', 'error');
    }
  };

  const openHistory = async (row) => {
    setHistoryMember(row);
    setHistoryLoading(true);
    try {
      const res = await getMemberHistory(row.id, { page: 0, size: 50 });
      setHistory(res.data?.content || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const columns = [
    {
      field: 'employeeId', headerName: 'Employee ID',
      render: (row) => <Box component="span" sx={{ fontWeight: 600, color: colors.primary, whiteSpace: 'nowrap' }}>{row.employeeId}</Box>,
    },
    { field: 'name', headerName: 'Name', render: (row) => <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600 }}>{row.name}</Typography> },
    { field: 'department', headerName: 'Department', render: (row) => row.department || <Box component="span" sx={{ color: colors.textMuted }}>—</Box> },
    { field: 'email', headerName: 'Email', render: (row) => row.email || <Box component="span" sx={{ color: colors.textMuted }}>—</Box> },
    { field: 'phone', headerName: 'Phone', render: (row) => row.phone || <Box component="span" sx={{ color: colors.textMuted }}>—</Box> },
    {
      field: 'activeIssues', headerName: 'Holding', align: 'center',
      render: (row) => (
        <Chip size="small" label={row.activeIssues ?? 0}
          sx={{ fontWeight: 700, bgcolor: row.activeIssues > 0 ? colors.primarySoft : '#F2F1EE', color: row.activeIssues > 0 ? colors.primary : colors.textSecondary }} />
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Members"
        subtitle="Employees and students who can borrow books."
        icon={Users}
        breadcrumbs={[{ label: 'Library' }, { label: 'Members' }]}
        actions={<Button variant="contained" startIcon={<Plus size={18} />} onClick={openCreate}>Add Member</Button>}
      />

      <Card sx={{ p: 2.5, mb: 4 }}>
        <Grid container spacing={2.5} alignItems="center">
          <Grid item xs={12} sm={8} md={5}>
            <TextField label="Search by name, ID, email, department" size="small" fullWidth value={keyword}
              placeholder="Results filter as you type"
              onChange={(e) => setKeyword(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search size={17} color={colors.textMuted} /></InputAdornment> }} />
          </Grid>
          {keyword && (
            <Grid item xs={12} sm={4} md={3}>
              <Button variant="text" startIcon={<X size={17} />} onClick={() => setKeyword('')}>Clear</Button>
            </Grid>
          )}
        </Grid>
      </Card>

      <DataTable
        columns={columns} rows={rows} loading={loading} page={page} rowsPerPage={size}
        totalElements={total} onPageChange={setPage} onRowsPerPageChange={(s) => { setSize(s); setPage(0); }}
        emptyState={{ icon: Users, title: 'No members found', description: 'Add your first member to start issuing books.', actionLabel: 'Add Member', onAction: openCreate }}
        renderActions={(row) => (
          <Box sx={{ display: 'inline-flex', gap: 0.875 }}>
            <Tooltip title="Borrowing history"><IconButton size="small" onClick={() => openHistory(row)}><History size={18} /></IconButton></Tooltip>
            <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(row)}><Pencil size={18} /></IconButton></Tooltip>
            <Tooltip title="Delete"><IconButton size="small" sx={{ color: colors.danger }} onClick={() => setDeleteId(row.id)}><Trash2 size={18} /></IconButton></Tooltip>
          </Box>
        )}
      />

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editRow ? 'Edit Member' : 'Add Member'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}><TextField label="Employee ID" fullWidth required value={form.employeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField label="Name" fullWidth required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField label="Department" fullWidth value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField label="Phone" fullWidth value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Grid>
            <Grid item xs={12}><TextField label="Email" type="email" fullWidth value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      {/* History dialog */}
      <Dialog open={!!historyMember} onClose={() => setHistoryMember(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          Borrowing History — {historyMember?.name}
          <Typography sx={{ fontSize: '0.875rem', color: colors.textMuted }}>{historyMember?.employeeId}</Typography>
        </DialogTitle>
        <DialogContent>
          <DataTable
            minWidth={620}
            loading={historyLoading}
            rows={history}
            columns={[
              { field: 'bookCode', headerName: 'Code', render: (r) => <Box component="span" sx={{ color: colors.primary, fontWeight: 600 }}>{r.bookCode}</Box> },
              { field: 'bookTitle', headerName: 'Book' },
              { field: 'issueDate', headerName: 'Issued', render: (r) => formatDate(r.issueDate) },
              { field: 'dueDate', headerName: 'Due', render: (r) => formatDate(r.dueDate) },
              { field: 'returnDate', headerName: 'Returned', render: (r) => formatDate(r.returnDate) },
              { field: 'status', headerName: 'Status', render: (r) => <StatusBadge {...issueBadge(r.effectiveStatus)} /> },
            ]}
            emptyState={{ icon: History, title: 'No borrowing history', description: 'This member has not borrowed any books yet.', dense: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setHistoryMember(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteId} title="Delete Member"
        message="This will permanently remove the member. Members currently holding issued books cannot be deleted."
        onConfirm={handleDelete} onCancel={() => setDeleteId(null)} confirmText="Delete" />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack({ ...snack, open: false })}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default MembersPage;
