import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, TextField, Snackbar, Alert, Grid, Tooltip,
  Autocomplete, Chip, Typography,
} from '@mui/material';
import { Plus, Pencil, Trash2, PackagePlus, FolderKanban, Eye } from 'lucide-react';
import {
  getProjects, searchProjects, createProject, updateProject, deleteProject,
  recordProjectUsage,
} from '../api/projectApi';
import { getComponents } from '../api/componentApi';
import { getActiveTeamMembers } from '../api/teamMemberApi';
import { useAuth } from '../auth/AuthContext';
import { canWrite } from '../utils/roleUtils';
import DataTable from '../components/common/DataTable';
import ConfirmDialog from '../components/common/ConfirmDialog';
import ProjectDetailsDrawer from '../components/projects/ProjectDetailsDrawer';
import { PageHeader, StatusBadge, SearchBar } from '../components/ui';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { CURRENCY_SYMBOL } from '../utils/currency';
import { colors } from '../theme/tokens';

const STATUSES = ['ACTIVE', 'COMPLETED', 'ON_HOLD'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const PRIORITY_COLOR = {
  CRITICAL: colors.danger,
  HIGH: colors.warning,
  MEDIUM: colors.primary,
  LOW: colors.textSecondary,
};
const emptyForm = {
  projectName: '', description: '', projectManagerId: '', teamMemberIds: [],
  startDate: '', endDate: '', status: 'ACTIVE', priority: 'MEDIUM', budget: '',
};
const emptyUsage = { projectId: '', componentId: '', quantityUsed: 1, usageDate: '', remarks: '' };

const projectStatus = (s) => {
  switch (s) {
    case 'ACTIVE': return 'active';
    case 'COMPLETED': return 'completed';
    case 'ON_HOLD': return 'pending';
    default: return 'default';
  }
};

const ProjectsPage = () => {
  const { role } = useAuth();
  const writeAccess = canWrite(role);
  const [rows, setRows] = useState([]);
  const [components, setComponents] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsId, setDetailsId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [usageForm, setUsageForm] = useState(emptyUsage);
  const [editId, setEditId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, size, sortBy: 'projectName', sortDir: 'asc' };
      const res = debouncedKeyword.trim()
        ? await searchProjects({ ...params, keyword: debouncedKeyword.trim() })
        : await getProjects(params);
      setRows(res.data?.content || []);
      setTotal(res.data?.totalElements || 0);
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Failed to load projects', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, size, debouncedKeyword]);

  useEffect(() => { fetchData(); }, [fetchData]);
  // A new search has to start from page 1, or an existing page offset can land
  // past the end of the filtered result set and show an empty table.
  useEffect(() => { setPage(0); }, [debouncedKeyword]);
  useEffect(() => {
    getComponents({ page: 0, size: 500 }).then((r) => setComponents(r.data?.content || [])).catch(() => {});
    // Only members still active are offered; the ones retired in Settings stay on the
    // projects they already worked on but drop out of these dropdowns.
    getActiveTeamMembers().then((r) => setTeamMembers(r.data || [])).catch(() => {});
  }, []);

  /**
   * Bridges the old free-text staffing to the new roster.
   *
   * A project saved before this feature has names but no ids. Matching them back by name
   * — case-insensitively, the same rule the server-side migration used — means editing
   * such a project shows its real team instead of empty dropdowns that would erase the
   * assignment the moment someone pressed Save.
   */
  const matchMemberIdByName = (name) => {
    if (!name) return '';
    const hit = teamMembers.find((m) => m.name.toLowerCase() === String(name).trim().toLowerCase());
    return hit ? hit.id : '';
  };

  const matchMemberIdsByNames = (csv) => {
    if (!csv) return [];
    return String(csv)
      .split(',')
      .map((part) => matchMemberIdByName(part))
      .filter(Boolean);
  };

  const openCreate = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (row) => {
    setEditId(row.id);
    setForm({
      projectName: row.projectName || '', description: row.description || '',
      // Fall back to matching the legacy names for projects saved before the roster
      // existed, so opening one of them preselects the right people instead of blank
      // dropdowns that would wipe the assignment on the next save.
      projectManagerId: row.projectManagerId ?? matchMemberIdByName(row.projectManager),
      teamMemberIds: row.teamMemberIds?.length
        ? row.teamMemberIds
        : matchMemberIdsByNames(row.teamMembers),
      startDate: row.startDate || '', endDate: row.endDate || '', status: row.status || 'ACTIVE',
      priority: row.priority || 'MEDIUM', budget: row.budget ?? '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      // Budget is optional: an empty box means "not set", not zero.
      // The manager and team go as ids; the server derives the display names from the
      // roster, which is what keeps the old string columns — and every screen still
      // reading them — correct without this page having to compose them.
      const payload = {
        ...form,
        budget: form.budget === '' ? null : Number(form.budget),
        projectManagerId: form.projectManagerId === '' ? null : Number(form.projectManagerId),
        teamMemberIds: form.teamMemberIds.map(Number),
      };
      if (editId) {
        await updateProject(editId, payload);
        setSnack({ open: true, message: 'Project updated', severity: 'success' });
      } else {
        await createProject(payload);
        setSnack({ open: true, message: 'Project created', severity: 'success' });
      }
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Save failed', severity: 'error' });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteProject(deleteId);
      setSnack({ open: true, message: 'Project deleted', severity: 'success' });
      setDeleteId(null);
      fetchData();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Delete failed', severity: 'error' });
    }
  };

  const openUsage = (projectId) => {
    setUsageForm({ ...emptyUsage, projectId: String(projectId) });
    setUsageOpen(true);
  };

  const selectedComponent = useMemo(
    () => components.find((c) => String(c.id) === String(usageForm.componentId)) || null,
    [components, usageForm.componentId],
  );

  /**
   * Stock check, recomputed on every keystroke rather than on submit.
   *
   * The server still enforces this — ProjectComponentUsageService throws
   * InsufficientStockException regardless of what the client sends — but finding out
   * after pressing Record Usage means retyping the whole form. Comparing here turns it
   * into a warning that appears as the number is typed.
   */
  const requestedQty = Number(usageForm.quantityUsed);
  const availableQty = selectedComponent?.quantity ?? null;
  const qtyIsValid = Number.isFinite(requestedQty) && requestedQty >= 1;
  const exceedsStock = selectedComponent != null && qtyIsValid && requestedQty > availableQty;
  const canRecordUsage = selectedComponent != null && qtyIsValid && !exceedsStock;

  const handleUsage = async () => {
    try {
      await recordProjectUsage({
        projectId: Number(usageForm.projectId),
        componentId: Number(usageForm.componentId),
        quantityUsed: Number(usageForm.quantityUsed),
        usageDate: usageForm.usageDate || null,
        remarks: usageForm.remarks,
      });
      setSnack({ open: true, message: 'Component usage recorded', severity: 'success' });
      setUsageOpen(false);
      // Stock just moved. Refetching keeps the availability shown in this dialog honest
      // for the next assignment instead of comparing against a figure from page load.
      getComponents({ page: 0, size: 500 })
        .then((r) => setComponents(r.data?.content || []))
        .catch(() => {});
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Usage failed', severity: 'error' });
    }
  };

  const openDetails = (row) => { setDetailsId(row.id); setDetailsOpen(true); };

  const columns = [
    {
      field: 'projectName', headerName: 'Project',
      render: (row) => (
        <Box
          component="button"
          type="button"
          onClick={() => openDetails(row)}
          sx={{
            all: 'unset', cursor: 'pointer', fontWeight: 600, color: colors.primary,
            '&:hover': { textDecoration: 'underline' },
            '&:focus-visible': { outline: `2px solid ${colors.primary}`, outlineOffset: 2, borderRadius: '2px' },
          }}
        >
          {row.projectName}
        </Box>
      ),
    },
    { field: 'status', headerName: 'Status', render: (row) => <StatusBadge status={projectStatus(row.status)} label={row.status} /> },
    {
      field: 'priority', headerName: 'Priority',
      render: (row) => (row.priority
        ? <Box component="span" sx={{ fontWeight: 600, color: PRIORITY_COLOR[row.priority] || colors.textSecondary }}>{row.priority}</Box>
        : <Box component="span" sx={{ color: colors.textMuted }}>—</Box>),
    },
    { field: 'projectManager', headerName: 'Manager' },
    { field: 'startDate', headerName: 'Start' },
    { field: 'endDate', headerName: 'End' },
  ];

  return (
    <Box>
      <PageHeader
        title="Projects"
        subtitle="Plan projects and track component consumption across each one."
        icon={FolderKanban}
        breadcrumbs={[{ label: 'Manage' }, { label: 'Projects' }]}
        actions={
          <>
            <SearchBar
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search projects…"
              width={220}
              sx={{ display: { xs: 'none', sm: 'flex' } }}
            />
            {writeAccess && (
              <Button variant="contained" startIcon={<Plus size={16} />} onClick={openCreate}>Add Project</Button>
            )}
          </>
        }
      />

      <DataTable
        columns={columns} rows={rows} loading={loading} page={page} rowsPerPage={size}
        totalElements={total} onPageChange={setPage} onRowsPerPageChange={(s) => { setSize(s); setPage(0); }}
        emptyState={{
          icon: FolderKanban,
          title: 'No projects yet',
          description: 'Create your first project to start tracking component usage.',
          actionLabel: writeAccess ? 'Add Project' : undefined,
          onAction: writeAccess ? openCreate : undefined,
        }}
        renderActions={(row) => (
          <Box sx={{ display: 'inline-flex', gap: 0.5 }}>
            <Tooltip title="View details"><IconButton size="small" onClick={() => openDetails(row)}><Eye size={16} /></IconButton></Tooltip>
            {writeAccess && (
              <>
                <Tooltip title="Assign component"><IconButton size="small" sx={{ color: colors.primary }} onClick={() => openUsage(row.id)}><PackagePlus size={17} /></IconButton></Tooltip>
                <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(row)}><Pencil size={17} /></IconButton></Tooltip>
                <Tooltip title="Delete"><IconButton size="small" sx={{ color: colors.danger }} onClick={() => setDeleteId(row.id)}><Trash2 size={17} /></IconButton></Tooltip>
              </>
            )}
          </Box>
        )}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? 'Edit Project' : 'Add Project'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}><TextField label="Project Name" fullWidth required value={form.projectName}
              onChange={(e) => setForm({ ...form, projectName: e.target.value })} /></Grid>
            <Grid item xs={12}><TextField label="Description" fullWidth multiline rows={2} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select label="Project Manager" fullWidth
                value={form.projectManagerId}
                onChange={(e) => setForm({ ...form, projectManagerId: e.target.value })}
                helperText={teamMembers.length
                  ? 'Chosen from the roster in Settings'
                  : 'No team members yet — add them in Settings'}
              >
                <MenuItem value=""><em>Unassigned</em></MenuItem>
                {teamMembers.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.name}{m.designation ? ` · ${m.designation}` : ''}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Autocomplete
                multiple
                options={teamMembers}
                getOptionLabel={(m) => m.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                // The form holds ids, so the selected objects are derived from them —
                // one source of truth, and the value survives the options loading late.
                value={teamMembers.filter((m) => form.teamMemberIds.includes(m.id))}
                onChange={(_, selected) =>
                  setForm({ ...form, teamMemberIds: selected.map((m) => m.id) })}
                renderTags={(value, getTagProps) =>
                  value.map((m, index) => (
                    <Chip size="small" label={m.name} {...getTagProps({ index })} key={m.id} />
                  ))}
                renderInput={(params) => (
                  <TextField
                    {...params} label="Team Members"
                    placeholder={form.teamMemberIds.length ? '' : 'Select members'}
                    helperText={teamMembers.length
                      ? 'Only members configured in Settings appear here'
                      : 'No team members yet — add them in Settings'}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}><TextField label="Start Date" type="date" fullWidth InputLabelProps={{ shrink: true }}
              value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField label="End Date" type="date" fullWidth InputLabelProps={{ shrink: true }}
              value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Grid>
            <Grid item xs={12} sm={4}><TextField select label="Status" fullWidth value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map((s) => <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>)}
            </TextField></Grid>
            <Grid item xs={12} sm={4}><TextField select label="Priority" fullWidth value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</MenuItem>)}
            </TextField></Grid>
            <Grid item xs={12} sm={4}><TextField label={`Budget (${CURRENCY_SYMBOL})`} type="number" fullWidth
              inputProps={{ min: 0, step: '0.01' }} placeholder="Optional"
              value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={usageOpen} onClose={() => setUsageOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Component Usage</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              {/* A searchable field rather than a plain select: with a few hundred
                  components, scrolling a dropdown to find one is the slow part of this
                  form. Typing filters on name, rack and category at once. */}
              <Autocomplete
                options={components}
                value={selectedComponent}
                onChange={(_, picked) =>
                  setUsageForm({ ...usageForm, componentId: picked ? picked.id : '' })}
                getOptionLabel={(c) => c.componentName || ''}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                filterOptions={(options, { inputValue }) => {
                  const q = inputValue.trim().toLowerCase();
                  if (!q) return options;
                  return options.filter((c) => [c.componentName, c.rackNo, c.category, c.location]
                    .some((field) => String(field || '').toLowerCase().includes(q)));
                }}
                renderOption={(props, c) => {
                  const { key, ...rest } = props;
                  return (
                    <Box component="li" key={key} {...rest}
                      sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }} noWrap>
                          {c.componentName}
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted }} noWrap>
                          {[c.category, c.rackNo ? `Rack ${c.rackNo}` : null]
                            .filter(Boolean).join(' · ') || '—'}
                        </Typography>
                      </Box>
                      {/* Stock is shown in the list too, so an out-of-stock component is
                          obvious before it is selected rather than after. */}
                      <Typography
                        sx={{
                          fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap',
                          color: Number(c.quantity) > 0 ? colors.textSecondary : colors.danger,
                        }}
                      >
                        {Number(c.quantity || 0).toLocaleString()} in stock
                      </Typography>
                    </Box>
                  );
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Component" required
                    placeholder="Search by name, rack no or category…" />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Quantity Used" type="number" fullWidth required
                inputProps={{ min: 1 }}
                value={usageForm.quantityUsed}
                onChange={(e) => setUsageForm({ ...usageForm, quantityUsed: e.target.value })}
                error={exceedsStock}
                helperText={selectedComponent
                  ? `Available: ${Number(availableQty || 0).toLocaleString()}${
                    qtyIsValid ? ` · Requested: ${requestedQty.toLocaleString()}` : ''}`
                  : 'Select a component to see its available stock'}
              />
            </Grid>
            {exceedsStock && (
              <Grid item xs={12}>
                <Alert severity="error" variant="outlined" sx={{ py: 0.5 }}>
                  Only <strong>{Number(availableQty || 0).toLocaleString()}</strong> of{' '}
                  <strong>{selectedComponent.componentName}</strong> in stock — you asked for{' '}
                  <strong>{requestedQty.toLocaleString()}</strong>. Reduce the quantity, or
                  restock before recording this usage.
                </Alert>
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField label="Usage Date" type="date" fullWidth InputLabelProps={{ shrink: true }}
                value={usageForm.usageDate} onChange={(e) => setUsageForm({ ...usageForm, usageDate: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Remarks" fullWidth required value={usageForm.remarks}
                onChange={(e) => setUsageForm({ ...usageForm, remarks: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setUsageOpen(false)}>Cancel</Button>
          {/* Disabled rather than left clickable-and-rejected: the server would refuse
              this anyway, so blocking it here saves a round trip and a lost form. */}
          <Button variant="contained" onClick={handleUsage} disabled={!canRecordUsage}>
            Record Usage
          </Button>
        </DialogActions>
      </Dialog>

      {/* Full project card — supersedes the old usage-summary dialog, which showed
          only component quantities with none of the surrounding context. */}
      <ProjectDetailsDrawer
        projectId={detailsId}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        canWrite={writeAccess}
        onEdit={(p) => { setDetailsOpen(false); openEdit(p); }}
        onAssignComponent={(p) => { setDetailsOpen(false); openUsage(p.id); }}
      />

      <ConfirmDialog open={!!deleteId} title="Delete Project"
        message="Are you sure you want to delete this project?"
        onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack({ ...snack, open: false })}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default ProjectsPage;
