import { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Card, TextField, Snackbar, Alert, Grid, Autocomplete, Typography, Divider,
} from '@mui/material';
import { BookUp, Send } from 'lucide-react';
import { getBooks } from '../../api/library/bookApi';
import { getMembers } from '../../api/library/memberApi';
import { issueBook, getIssues } from '../../api/library/issueApi';
import { PageHeader, StatusBadge } from '../../components/ui';
import { issueBadge, formatDate } from '../../utils/libraryStatus';
import { colors } from '../../theme/tokens';

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const IssueBookPage = () => {
  const [books, setBooks] = useState([]);
  const [members, setMembers] = useState([]);
  const [book, setBook] = useState(null);
  const [member, setMember] = useState(null);
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState(addDays(14));
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [recent, setRecent] = useState([]);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const notify = (message, severity = 'success') => setSnack({ open: true, message, severity });

  const loadBooks = (keyword = '') =>
    getBooks({ page: 0, size: 20, keyword, status: 'ACTIVE' })
      .then((res) => setBooks(res.data?.content || [])).catch(() => {});
  const loadMembers = (keyword = '') =>
    getMembers({ page: 0, size: 20, keyword })
      .then((res) => setMembers(res.data?.content || [])).catch(() => {});
  const loadRecent = () =>
    getIssues({ page: 0, size: 6, status: 'ISSUED', sortBy: 'issueDate', sortDir: 'desc' })
      .then((res) => setRecent(res.data?.content || [])).catch(() => {});

  useEffect(() => { loadBooks(); loadMembers(); loadRecent(); }, []);

  const canSubmit = book && member && book.availableCopies > 0;

  const reset = () => {
    setBook(null); setMember(null); setRemarks('');
    setIssueDate(today()); setDueDate(addDays(14));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await issueBook({ bookId: book.id, memberId: member.id, issueDate, dueDate, remarks });
      notify(`"${book.title}" issued to ${member.name}`);
      reset();
      loadBooks(); loadRecent();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to issue book', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedBookInfo = useMemo(() => {
    if (!book) return null;
    return `${book.availableCopies} of ${book.totalCopies} copies available`;
  }, [book]);

  return (
    <Box>
      <PageHeader
        title="Issue Book"
        subtitle="Hand a book to a member and record the loan."
        icon={BookUp}
        breadcrumbs={[{ label: 'Library' }, { label: 'Issue Book' }]}
      />

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Card sx={{ p: { xs: 2.5, md: 3.5 } }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Autocomplete
                  options={books}
                  value={book}
                  onChange={(_, v) => setBook(v)}
                  onInputChange={(_, v, reason) => { if (reason === 'input') loadBooks(v); }}
                  getOptionLabel={(o) => (o ? `${o.bookCode} — ${o.title}` : '')}
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                  getOptionDisabled={(o) => o.availableCopies < 1}
                  renderOption={(props, o) => (
                    <Box component="li" {...props} key={o.id}>
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                          <Box component="span" sx={{ color: colors.primary, mr: 1 }}>{o.bookCode}</Box>{o.title}
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted }}>
                          {o.author || '—'} · {o.availableCopies} available
                        </Typography>
                      </Box>
                    </Box>
                  )}
                  renderInput={(params) => <TextField {...params} label="Book" required placeholder="Search by code or title" />}
                />
                {book && (
                  <Typography sx={{ fontSize: '0.8125rem', mt: 1, color: book.availableCopies > 0 ? colors.success : colors.danger }}>
                    {selectedBookInfo}
                  </Typography>
                )}
              </Grid>

              <Grid item xs={12}>
                <Autocomplete
                  options={members}
                  value={member}
                  onChange={(_, v) => setMember(v)}
                  onInputChange={(_, v, reason) => { if (reason === 'input') loadMembers(v); }}
                  getOptionLabel={(o) => (o ? `${o.name} (${o.employeeId})` : '')}
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                  renderOption={(props, o) => (
                    <Box component="li" {...props} key={o.id}>
                      <Box>
                        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>{o.name}</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted }}>
                          {o.employeeId}{o.department ? ` · ${o.department}` : ''} · holding {o.activeIssues ?? 0}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                  renderInput={(params) => <TextField {...params} label="Member" required placeholder="Search by name or ID" />}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField label="Issue Date" type="date" fullWidth value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Due Date" type="date" fullWidth value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12}>
                <TextField label="Remarks" fullWidth multiline rows={2} value={remarks}
                  onChange={(e) => setRemarks(e.target.value)} placeholder="Optional note" />
              </Grid>
              <Grid item xs={12}>
                <Button variant="contained" size="large" startIcon={<Send size={18} />}
                  disabled={!canSubmit || submitting} onClick={handleSubmit}>
                  {submitting ? 'Issuing…' : 'Issue Book'}
                </Button>
              </Grid>
            </Grid>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 650, mb: 0.25 }}>Recently Issued</Typography>
            <Typography sx={{ fontSize: '0.875rem', color: colors.textMuted, mb: 2 }}>Latest active loans</Typography>
            <Divider sx={{ mb: 1.5 }} />
            {recent.length === 0 ? (
              <Typography sx={{ color: colors.textMuted, py: 3, textAlign: 'center' }}>No active loans yet.</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {recent.map((r) => (
                  <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }} noWrap>{r.bookTitle}</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted }} noWrap>
                        {r.memberName} · due {formatDate(r.dueDate)}
                      </Typography>
                    </Box>
                    <StatusBadge {...issueBadge(r.effectiveStatus)} />
                  </Box>
                ))}
              </Box>
            )}
          </Card>
        </Grid>
      </Grid>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack({ ...snack, open: false })}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default IssueBookPage;
