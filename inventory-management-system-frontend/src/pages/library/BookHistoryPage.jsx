import { useCallback, useEffect, useState } from 'react';
import {
  Box, Card, TextField, MenuItem, Grid, InputAdornment, Typography, Snackbar, Alert,
} from '@mui/material';
import { History, Search } from 'lucide-react';
import { getIssueHistory } from '../../api/library/issueApi';
import DataTable from '../../components/common/DataTable';
import { PageHeader, StatusBadge } from '../../components/ui';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { issueBadge, formatDate } from '../../utils/libraryStatus';
import { colors } from '../../theme/tokens';

const STATUS = [
  { value: '', label: 'All records' },
  { value: 'ISSUED', label: 'Issued' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'OVERDUE', label: 'Overdue' },
];

const BookHistoryPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const [status, setStatus] = useState('');
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'error' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getIssueHistory({ page, size, keyword: debouncedKeyword.trim(), status, sortBy: 'issueDate', sortDir: 'desc' });
      setRows(res.data?.content || []);
      setTotal(res.data?.totalElements || 0);
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Failed to load history', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, size, debouncedKeyword, status]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(0); }, [debouncedKeyword]);

  const columns = [
    { field: 'bookCode', headerName: 'Code', render: (r) => <Box component="span" sx={{ color: colors.primary, fontWeight: 600 }}>{r.bookCode}</Box> },
    {
      field: 'bookTitle', headerName: 'Book',
      render: (r) => (
        <Box>
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>{r.bookTitle}</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted }}>{r.memberName} · {r.memberEmployeeId}</Typography>
        </Box>
      ),
    },
    { field: 'issueDate', headerName: 'Issued', render: (r) => formatDate(r.issueDate) },
    { field: 'dueDate', headerName: 'Due', render: (r) => formatDate(r.dueDate) },
    { field: 'returnDate', headerName: 'Returned', render: (r) => formatDate(r.returnDate) },
    { field: 'issuedBy', headerName: 'Issued By', render: (r) => r.issuedBy || <Box component="span" sx={{ color: colors.textMuted }}>—</Box> },
    { field: 'status', headerName: 'Status', render: (r) => <StatusBadge {...issueBadge(r.effectiveStatus)} /> },
  ];

  return (
    <Box>
      <PageHeader
        title="Book History"
        subtitle="Complete lending record across all books and members."
        icon={History}
        breadcrumbs={[{ label: 'Library' }, { label: 'Book History' }]}
      />

      <Card sx={{ p: 2, mb: 2.5 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <TextField label="Search by book or member" size="small" fullWidth value={keyword}
              placeholder="Results filter as you type"
              onChange={(e) => setKeyword(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search size={17} color={colors.textMuted} /></InputAdornment> }} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField label="Status" size="small" fullWidth select value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
              {STATUS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
            </TextField>
          </Grid>
        </Grid>
      </Card>

      <DataTable
        columns={columns} rows={rows} loading={loading} page={page} rowsPerPage={size}
        totalElements={total} onPageChange={setPage} onRowsPerPageChange={(s) => { setSize(s); setPage(0); }}
        emptyState={{ icon: History, title: 'No lending records', description: 'Issue a book to start building history.', dense: true }}
      />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack({ ...snack, open: false })}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default BookHistoryPage;
