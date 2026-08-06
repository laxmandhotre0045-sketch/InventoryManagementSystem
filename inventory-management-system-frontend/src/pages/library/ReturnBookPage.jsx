import { useCallback, useEffect, useState } from 'react';
import {
  Box, Button, Card, Dialog, DialogActions, DialogContent, DialogTitle,
  TextField, Snackbar, Alert, Grid, InputAdornment, Typography,
} from '@mui/material';
import { BookDown, Search, Undo2, X } from 'lucide-react';
import { getIssueHistory, returnBook } from '../../api/library/issueApi';
import DataTable from '../../components/common/DataTable';
import { PageHeader, StatusBadge } from '../../components/ui';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { issueBadge, formatDate } from '../../utils/libraryStatus';
import { colors } from '../../theme/tokens';

const today = () => new Date().toISOString().slice(0, 10);

const ReturnBookPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const [target, setTarget] = useState(null);
  const [returnDate, setReturnDate] = useState(today());
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const notify = (message, severity = 'success') => setSnack({ open: true, message, severity });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Outstanding loans: stored status ISSUED (overdue ones are a derived subset).
      const res = await getIssueHistory({ page, size, keyword: debouncedKeyword.trim(), status: 'ISSUED', sortBy: 'dueDate', sortDir: 'asc' });
      setRows(res.data?.content || []);
      setTotal(res.data?.totalElements || 0);
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to load issued books', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, size, debouncedKeyword]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(0); }, [debouncedKeyword]);

  const openReturn = (row) => { setTarget(row); setReturnDate(today()); setRemarks(row.remarks || ''); };

  const handleReturn = async () => {
    if (!target) return;
    setSubmitting(true);
    try {
      await returnBook({ issueId: target.id, returnDate, remarks });
      notify(`"${target.bookTitle}" returned`);
      setTarget(null);
      fetchData();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to return book', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { field: 'bookCode', headerName: 'Code', render: (r) => <Box component="span" sx={{ color: colors.primary, fontWeight: 600 }}>{r.bookCode}</Box> },
    {
      field: 'bookTitle', headerName: 'Book',
      render: (r) => (
        <Box>
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600 }}>{r.bookTitle}</Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: colors.textMuted }}>{r.memberName} · {r.memberEmployeeId}</Typography>
        </Box>
      ),
    },
    { field: 'issueDate', headerName: 'Issued', render: (r) => formatDate(r.issueDate) },
    {
      field: 'dueDate', headerName: 'Due',
      render: (r) => (
        <Box component="span" sx={{ color: r.overdue ? colors.danger : colors.textPrimary, fontWeight: r.overdue ? 700 : 500 }}>
          {formatDate(r.dueDate)}{r.overdue ? ` (${r.daysOverdue}d)` : ''}
        </Box>
      ),
    },
    { field: 'status', headerName: 'Status', render: (r) => <StatusBadge {...issueBadge(r.effectiveStatus)} /> },
  ];

  return (
    <Box>
      <PageHeader
        title="Return Book"
        subtitle="Record returns and free up copies."
        icon={BookDown}
        breadcrumbs={[{ label: 'Library' }, { label: 'Return Book' }]}
      />

      <Card sx={{ p: 2.5, mb: 4 }}>
        <Grid container spacing={2.5} alignItems="center">
          <Grid item xs={12} sm={8} md={5}>
            <TextField label="Search by book or member" size="small" fullWidth value={keyword}
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
        emptyState={{ icon: BookDown, title: 'No outstanding loans', description: 'Every issued book has been returned.', dense: true }}
        renderActions={(row) => (
          <Button size="small" variant="outlined" startIcon={<Undo2 size={16} />} onClick={() => openReturn(row)}>Return</Button>
        )}
      />

      <Dialog open={!!target} onClose={() => setTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Return Book</DialogTitle>
        <DialogContent>
          {target && (
            <Box sx={{ pt: 0.5 }}>
              <Typography sx={{ fontSize: '1.0625rem', fontWeight: 700 }}>{target.bookTitle}</Typography>
              <Typography sx={{ color: colors.textMuted, mb: 2 }}>
                {target.memberName} · issued {formatDate(target.issueDate)} · due {formatDate(target.dueDate)}
              </Typography>
              <TextField label="Return Date" type="date" fullWidth value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ mb: 2 }} />
              <TextField label="Remarks" fullWidth multiline rows={2} value={remarks}
                onChange={(e) => setRemarks(e.target.value)} placeholder="Optional (e.g. condition on return)" />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setTarget(null)} disabled={submitting}>Cancel</Button>
          <Button variant="contained" onClick={handleReturn} disabled={submitting}>{submitting ? 'Saving…' : 'Confirm Return'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack({ ...snack, open: false })}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default ReturnBookPage;
