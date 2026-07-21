import { useCallback, useEffect, useState } from 'react';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, TextField, Typography, Snackbar, Alert, Grid, Paper, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import AssignmentIcon from '@mui/icons-material/Assignment';
import {
  getProjects, searchProjects, createProject, updateProject, deleteProject,
  getProjectUsageSummary, recordProjectUsage,
} from '../api/projectApi';
import { getComponents } from '../api/componentApi';
import { useAuth } from '../auth/AuthContext';
import { canWrite } from '../utils/roleUtils';
import DataTable from '../components/common/DataTable';
import ConfirmDialog from '../components/common/ConfirmDialog';

const STATUSES = ['ACTIVE', 'COMPLETED', 'ON_HOLD'];
const emptyForm = { projectName: '', description: '', startDate: '', endDate: '', status: 'ACTIVE' };
const emptyUsage = { projectId: '', componentId: '', quantityUsed: 1, usageDate: '', remarks: '' };

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [usageForm, setUsageForm] = useState(emptyUsage);
  const [editId, setEditId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, size, sortBy: 'projectName', sortDir: 'asc' };
      const res = keyword.trim()
        ? await searchProjects({ ...params, keyword: keyword.trim() })
        : await getProjects(params);
      setRows(res.data?.content || []);
      setTotal(res.data?.totalElements || 0);
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Failed to load projects', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, size, keyword]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    getComponents({ page: 0, size: 500 }).then((r) => setComponents(r.data?.content || []));
  }, []);

  const openCreate = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (row) => {
    setEditId(row.id);
    setForm({
      projectName: row.projectName || '', description: row.description || '',
      startDate: row.startDate || '', endDate: row.endDate || '', status: row.status || 'ACTIVE',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editId) {
        await updateProject(editId, form);
        setSnack({ open: true, message: 'Project updated', severity: 'success' });
      } else {
        await createProject(form);
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

  const viewSummary = async (projectId) => {
    try {
      const res = await getProjectUsageSummary(projectId);
      setSummary(res.data);
      setSummaryOpen(true);
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Failed to load summary', severity: 'error' });
    }
  };

  const columns = [
    { field: 'projectName', headerName: 'Project' },
    { field: 'status', headerName: 'Status', render: (row) => <Chip label={row.status} size="small" /> },
    { field: 'startDate', headerName: 'Start' },
    { field: 'endDate', headerName: 'End' },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5">Projects</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField size="small" placeholder="Search..." value={keyword}
            onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchData()} />
          <Button variant="outlined" startIcon={<SearchIcon />} onClick={fetchData}>Search</Button>
          {writeAccess && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add Project</Button>
          )}
        </Box>
      </Box>

      <DataTable
        columns={columns} rows={rows} loading={loading} page={page} rowsPerPage={size}
        totalElements={total} onPageChange={setPage} onRowsPerPageChange={(s) => { setSize(s); setPage(0); }}
        renderActions={(row) => (
          <Box>
            <IconButton size="small" onClick={() => viewSummary(row.id)} title="Usage summary">
              <AssignmentIcon fontSize="small" />
            </IconButton>
            {writeAccess && (
              <>
                <IconButton size="small" onClick={() => openUsage(row.id)} title="Assign component">+</IconButton>
                <IconButton size="small" onClick={() => openEdit(row)}><EditIcon fontSize="small" /></IconButton>
                <IconButton size="small" color="error" onClick={() => setDeleteId(row.id)}><DeleteIcon fontSize="small" /></IconButton>
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
            <Grid item xs={12} sm={6}><TextField label="Start Date" type="date" fullWidth InputLabelProps={{ shrink: true }}
              value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField label="End Date" type="date" fullWidth InputLabelProps={{ shrink: true }}
              value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Grid>
            <Grid item xs={12}><TextField select label="Status" fullWidth value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
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
          <Button onClick={() => setUsageOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUsage}>Record Usage</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={summaryOpen} onClose={() => setSummaryOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Usage Summary — {summary?.projectName}</DialogTitle>
        <DialogContent>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead><TableRow><TableCell>Component</TableCell><TableCell>Qty Used</TableCell></TableRow></TableHead>
              <TableBody>
                {(summary?.components || []).map((c, i) => (
                  <TableRow key={i}><TableCell>{c.componentName}</TableCell><TableCell>{c.quantityUsed}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions><Button onClick={() => setSummaryOpen(false)}>Close</Button></DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteId} title="Delete Project"
        message="Are you sure you want to delete this project?"
        onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert severity={snack.severity}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default ProjectsPage;
