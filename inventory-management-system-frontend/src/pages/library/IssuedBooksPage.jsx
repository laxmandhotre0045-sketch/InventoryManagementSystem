import { useCallback, useEffect, useState } from 'react';
import {
  Box, Card, TextField, MenuItem, Grid, InputAdornment, Typography, Snackbar, Alert,
} from '@mui/material';
import { BookMarked, Search } from 'lucide-react';
import { getIssueHistory } from '../../api/library/issueApi';
import DataTable from '../../components/common/DataTable';
import { PageHeader, StatusBadge } from '../../components/ui';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { issueBadge, formatDate } from '../../utils/libraryStatus';
import { colors } from '../../theme/tokens';

// Currently-outstanding loans. "Overdue only" narrows to loans past their due date.
const FILTERS = [
  { value: 'ISSUED', label: 'All outstanding' },
  { value: 'OVERDUE', label: 'Overdue only' },
];

const IssuedBooksPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const [filter, setFilter] = useState('ISSUED');
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'error' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getIssueHistory({ page, size, keyword: debouncedKeyword.trim(), status: filter, sortBy: 'dueDate', sortDir: 'asc' });
      setRows(res.data?.content || []);
      setTotal(res.data?.totalElements || 0);
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Failed to load issued books', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, size, debouncedKeyword, filter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(0); }, [debouncedKeyword]);

  const columns = [
    { field: 'bookCode', headerName: 'Code', render: (r) => <Box component="span" sx={{ color: colors.primary, fontWeight: 600 }}>{r.bookCode}</Box> },
    {
      field: 'bookTitle', headerName: 'Book',
      render: (r) => (
        <Box>
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600 }}>{r.bookTitle}</Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: colors.textMuted }}>{r.bookAuthor || '—'}</Typography>
        </Box>
      ),
    },
    {
      field: 'member', headerName: 'Member',
      render: (r) => (
        <Box>
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 500 }}>{r.memberName}</Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: colors.textMuted }}>{r.memberEmployeeId}</Typography>
        </Box>
      ),
    },
    { field: 'issueDate', headerName: 'Issued', render: (r) => formatDate(r.issueDate) },
    {
      field: 'dueDate', headerName: 'Due',
      render: (r) => (
        <Box component="span" sx={{ color: r.overdue ? colors.danger : colors.textPrimary, fontWeight: r.overdue ? 700 : 500 }}>
          {formatDate(r.dueDate)}{r.overdue ? ` · ${r.daysOverdue}d late` : ''}
        </Box>
      ),
    },
    { field: 'issuedBy', headerName: 'Issued By', render: (r) => r.issuedBy || <Box component="span" sx={{ color: colors.textMuted }}>—</Box> },
    { field: 'status', headerName: 'Status', render: (r) => <StatusBadge {...issueBadge(r.effectiveStatus)} /> },
  ];

  return (
    <Box>
      <PageHeader
        title="Issued Books"
        subtitle="Books currently on loan across all members."
        icon={BookMarked}
        breadcrumbs={[{ label: 'Library' }, { label: 'Issued Books' }]}
      />

      <Card sx={{ p: 2.5, mb: 4 }}>
        <Grid container spacing={2.5} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <TextField label="Search by book or member" size="small" fullWidth value={keyword}
              placeholder="Results filter as you type"
              onChange={(e) => setKeyword(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search size={17} color={colors.textMuted} /></InputAdornment> }} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField label="Filter" size="small" fullWidth select value={filter}
              onChange={(e) => { setFilter(e.target.value); setPage(0); }}>
              {FILTERS.map((f) => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
            </TextField>
          </Grid>
        </Grid>
      </Card>

      <DataTable
        columns={columns} rows={rows} loading={loading} page={page} rowsPerPage={size}
        totalElements={total} onPageChange={setPage} onRowsPerPageChange={(s) => { setSize(s); setPage(0); }}
        emptyState={{ icon: BookMarked, title: 'Nothing on loan', description: 'No books match this filter right now.', dense: true }}
      />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack({ ...snack, open: false })}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default IssuedBooksPage;
