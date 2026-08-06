import { useCallback, useEffect, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, TextField, Snackbar, Alert, Grid, Tooltip,
} from '@mui/material';
import { Plus, Pencil, Trash2, PackagePlus, FolderKanban, Eye } from 'lucide-react';
import {
  getProjects, searchProjects, createProject, updateProject, deleteProject,
  recordProjectUsage,
} from '../api/projectApi';
import { getComponents } from '../api/componentApi';
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
  projectName: '', description: '', projectManager: '', teamMembers: '',
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
  }, []);

  const openCreate = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (row) => {
    setEditId(row.id);
    setForm({
      projectName: row.projectName || '', description: row.description || '',
      projectManager: row.projectManager || '', teamMembers: row.teamMembers || '',
      startDate: row.startDate || '', endDate: row.endDate || '', status: row.status || 'ACTIVE',
      priority: row.priority || 'MEDIUM', budget: row.budget ?? '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      // Budget is optional: an empty box means "not set", not zero.
      const payload = { ...form, budget: form.budget === '' ? null : Number(form.budget) };
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
            <Grid item xs={12} sm={6}><TextField label="Project Manager" fullWidth placeholder="e.g. R. Deshmukh"
              value={form.projectManager} onChange={(e) => setForm({ ...form, projectManager: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField label="Team Members" fullWidth placeholder="Comma separated"
              helperText="e.g. A. Patil, S. Kulkarni"
              value={form.teamMembers} onChange={(e) => setForm({ ...form, teamMembers: e.target.value })} /></Grid>
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

      <Dialog open={usageOpen} onClose={() => setUsageOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Assign Component Usage</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField select label="Component" fullWidth required value={usageForm.componentId}
                onChange={(e) => setUsageForm({ ...usageForm, componentId: e.target.value })}>
                {components.map((c) => <MenuItem key={c.id} value={c.id}>{c.componentName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField label="Quantity Used" type="number" fullWidth required inputProps={{ min: 1 }}
                value={usageForm.quantityUsed} onChange={(e) => setUsageForm({ ...usageForm, quantityUsed: e.target.value })} />
            </Grid>
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
          <Button variant="contained" onClick={handleUsage}>Record Usage</Button>
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
