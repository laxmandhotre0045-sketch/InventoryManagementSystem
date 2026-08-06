import { useCallback, useEffect, useState } from 'react';
import {
  Box, Card, Tabs, Tab, Autocomplete, TextField, Typography, Chip,
} from '@mui/material';
import { BarChart3, TrendingUp } from 'lucide-react';
import {
  getIssueHistory, getReturnedReport, getOverdueReport, getMostBorrowed,
} from '../../api/library/issueApi';
import { getMembers, getMemberHistory } from '../../api/library/memberApi';
import DataTable from '../../components/common/DataTable';
import { PageHeader, StatusBadge } from '../../components/ui';
import { issueBadge, formatDate } from '../../utils/libraryStatus';
import { colors } from '../../theme/tokens';

const bookCol = { field: 'bookCode', headerName: 'Code', render: (r) => <Box component="span" sx={{ color: colors.primary, fontWeight: 600 }}>{r.bookCode}</Box> };
const titleCol = {
  field: 'bookTitle', headerName: 'Book',
  render: (r) => (
    <Box>
      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>{r.bookTitle}</Typography>
      <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted }}>{r.memberName} · {r.memberEmployeeId}</Typography>
    </Box>
  ),
};
const statusCol = { field: 'status', headerName: 'Status', render: (r) => <StatusBadge {...issueBadge(r.effectiveStatus)} /> };

// A paged report table backed by one of the report endpoints.
const PagedReport = ({ fetcher, columns, empty }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetcher({ page, size });
      setRows(res.data?.content || []);
      setTotal(res.data?.totalElements || 0);
    } catch {
      setRows([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [fetcher, page, size]);

  useEffect(() => { load(); }, [load]);

  return (
    <DataTable
      columns={columns} rows={rows} loading={loading} page={page} rowsPerPage={size}
      totalElements={total} onPageChange={setPage} onRowsPerPageChange={(s) => { setSize(s); setPage(0); }}
      emptyState={empty}
    />
  );
};

const IssuedReport = () => (
  <PagedReport
    fetcher={(p) => getIssueHistory({ ...p, status: 'ISSUED', sortBy: 'issueDate', sortDir: 'desc' })}
    columns={[bookCol, titleCol,
      { field: 'issueDate', headerName: 'Issued', render: (r) => formatDate(r.issueDate) },
      { field: 'dueDate', headerName: 'Due', render: (r) => formatDate(r.dueDate) },
      { field: 'issuedBy', headerName: 'Issued By', render: (r) => r.issuedBy || '—' }, statusCol]}
    empty={{ icon: BarChart3, title: 'No issued books', description: 'Nothing is currently on loan.', dense: true }}
  />
);

const ReturnedReport = () => (
  <PagedReport
    fetcher={getReturnedReport}
    columns={[bookCol, titleCol,
      { field: 'issueDate', headerName: 'Issued', render: (r) => formatDate(r.issueDate) },
      { field: 'returnDate', headerName: 'Returned', render: (r) => formatDate(r.returnDate) }, statusCol]}
    empty={{ icon: BarChart3, title: 'No returns yet', description: 'Returned books will appear here.', dense: true }}
  />
);

const OverdueReport = () => (
  <PagedReport
    fetcher={getOverdueReport}
    columns={[bookCol, titleCol,
      { field: 'dueDate', headerName: 'Due', render: (r) => <Box component="span" sx={{ color: colors.danger, fontWeight: 700 }}>{formatDate(r.dueDate)}</Box> },
      { field: 'daysOverdue', headerName: 'Days Late', align: 'right', render: (r) => <Chip size="small" label={`${r.daysOverdue}d`} sx={{ bgcolor: colors.dangerSoft, color: colors.danger, fontWeight: 700 }} /> },
      statusCol]}
    empty={{ icon: BarChart3, title: 'No overdue books', description: 'Everything is on time.', dense: true }}
  />
);

const MostBorrowedReport = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(true);
    getMostBorrowed({ limit: 20 }).then((res) => setRows(res.data || [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  return (
    <DataTable
      loading={loading} rows={rows}
      columns={[
        { field: 'rank', headerName: '#', render: (r) => <Box component="span" sx={{ color: colors.textMuted }}>{rows.indexOf(r) + 1}</Box> },
        { field: 'bookCode', headerName: 'Code', render: (r) => <Box component="span" sx={{ color: colors.primary, fontWeight: 600 }}>{r.bookCode}</Box> },
        { field: 'title', headerName: 'Title', render: (r) => <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>{r.title}</Typography> },
        { field: 'author', headerName: 'Author', render: (r) => r.author || '—' },
        { field: 'borrowCount', headerName: 'Times Borrowed', align: 'right', render: (r) => <Chip size="small" icon={<TrendingUp size={14} />} label={r.borrowCount} sx={{ bgcolor: colors.primarySoft, color: colors.primary, fontWeight: 700, '& .MuiChip-icon': { color: colors.primary } }} /> },
      ]}
      emptyState={{ icon: TrendingUp, title: 'No data yet', description: 'Borrowing trends appear once books are issued.', dense: true }}
    />
  );
};

const MemberHistoryReport = () => {
  const [members, setMembers] = useState([]);
  const [member, setMember] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadMembers = (keyword = '') =>
    getMembers({ page: 0, size: 20, keyword }).then((res) => setMembers(res.data?.content || [])).catch(() => {});
  useEffect(() => { loadMembers(); }, []);

  useEffect(() => {
    if (!member) { setRows([]); return; }
    setLoading(true);
    getMemberHistory(member.id, { page: 0, size: 100 })
      .then((res) => setRows(res.data?.content || [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, [member]);

  return (
    <Box>
      <Autocomplete
        sx={{ maxWidth: 460, mb: 2.5 }}
        options={members}
        value={member}
        onChange={(_, v) => setMember(v)}
        onInputChange={(_, v, reason) => { if (reason === 'input') loadMembers(v); }}
        getOptionLabel={(o) => (o ? `${o.name} (${o.employeeId})` : '')}
        isOptionEqualToValue={(o, v) => o.id === v.id}
        renderInput={(params) => <TextField {...params} label="Select member" placeholder="Search by name or ID" size="small" />}
      />
      {member ? (
        <DataTable
          loading={loading} rows={rows} minWidth={620}
          columns={[bookCol,
            { field: 'bookTitle', headerName: 'Book' },
            { field: 'issueDate', headerName: 'Issued', render: (r) => formatDate(r.issueDate) },
            { field: 'dueDate', headerName: 'Due', render: (r) => formatDate(r.dueDate) },
            { field: 'returnDate', headerName: 'Returned', render: (r) => formatDate(r.returnDate) },
            statusCol]}
          emptyState={{ icon: BarChart3, title: 'No history', description: 'This member has not borrowed any books.', dense: true }}
        />
      ) : (
        <Card sx={{ p: 6, textAlign: 'center' }}>
          <Typography sx={{ color: colors.textMuted }}>Select a member to view their borrowing history.</Typography>
        </Card>
      )}
    </Box>
  );
};

const TABS = [
  { label: 'Issued Books', render: () => <IssuedReport /> },
  { label: 'Returned Books', render: () => <ReturnedReport /> },
  { label: 'Overdue Books', render: () => <OverdueReport /> },
  { label: 'Most Borrowed', render: () => <MostBorrowedReport /> },
  { label: 'Member History', render: () => <MemberHistoryReport /> },
];

const LibraryReportsPage = () => {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <PageHeader
        title="Reports"
        subtitle="Lending analytics across books and members."
        icon={BarChart3}
        breadcrumbs={[{ label: 'Library' }, { label: 'Reports' }]}
      />
      <Card sx={{ mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ px: 1, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.9375rem' } }}>
          {TABS.map((t) => <Tab key={t.label} label={t.label} />)}
        </Tabs>
      </Card>
      {TABS[tab].render()}
    </Box>
  );
};

export default LibraryReportsPage;
