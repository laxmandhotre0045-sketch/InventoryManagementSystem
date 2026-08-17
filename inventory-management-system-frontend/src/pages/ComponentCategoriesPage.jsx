import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardActionArea, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Grid, IconButton, Snackbar,
  TextField, Tooltip, Typography,
} from '@mui/material';
import {
  ArrowLeft, CircuitBoard, LayoutGrid, Package, Pencil, Plus, Trash2,
} from 'lucide-react';
import {
  createComponentCategory, deleteComponentCategory, getComponentCategories,
  updateComponentCategory,
} from '../api/componentCategoryApi';
import { getComponents } from '../api/componentApi';
import { useAuth } from '../auth/AuthContext';
import { canWrite } from '../utils/roleUtils';
import DataTable from '../components/common/DataTable';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { PageHeader, SearchBar, EmptyState } from '../components/ui';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { colors } from '../theme/tokens';

const emptyCategoryForm = { name: '', description: '' };

/**
 * Component categories, and the components inside them.
 *
 * <p>Splitting this out of the Components page was the point of the exercise: that screen
 * already carries a search box, four filters, a status legend and a nine-column table, and
 * folding category management into it made both jobs harder. Here a category is the unit of
 * navigation — pick one, see what is in it, add to it — while the Components page keeps
 * doing what it does across the whole catalogue.</p>
 *
 * <p>Two views share this route rather than two routes: selecting a category swaps the grid
 * for its component list. Keeping it on one route means the back action restores the grid
 * without a fetch, and a browser refresh lands somewhere sensible rather than on a
 * half-loaded child page.</p>
 */
const ComponentCategoriesPage = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const writeAccess = canWrite(role);

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebouncedValue(keyword, 300);

  // Null means "showing the category grid"; a category object means "showing its contents".
  const [selected, setSelected] = useState(null);
  const [components, setComponents] = useState([]);
  const [componentsLoading, setComponentsLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyCategoryForm);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const notify = (message, severity = 'success') => setSnack({ open: true, message, severity });

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getComponentCategories();
      setCategories(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  /**
   * Components of the selected category.
   *
   * Filtering happens server-side through categoryId — the parameter the components
   * endpoint already accepted — so this list paginates against the whole category rather
   * than filtering one page in the browser.
   */
  const fetchComponents = useCallback(async () => {
    if (!selected) return;
    setComponentsLoading(true);
    try {
      const res = await getComponents({
        categoryId: selected.id, page, size, sortBy: 'componentName', sortDir: 'asc',
      });
      setComponents(res.data?.content || []);
      setTotal(res.data?.totalElements || 0);
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to load components', 'error');
    } finally {
      setComponentsLoading(false);
    }
  }, [selected, page, size]);

  useEffect(() => { fetchComponents(); }, [fetchComponents]);

  const visibleCategories = useMemo(() => {
    const q = debouncedKeyword.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => [c.name, c.description]
      .some((field) => String(field || '').toLowerCase().includes(q)));
  }, [categories, debouncedKeyword]);

  const openCreate = () => { setEditId(null); setForm(emptyCategoryForm); setDialogOpen(true); };
  const openEdit = (category) => {
    setEditId(category.id);
    setForm({ name: category.name || '', description: category.description || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editId) {
        await updateComponentCategory(editId, form);
        notify('Category updated');
      } else {
        await createComponentCategory(form);
        notify('Category created');
      }
      setDialogOpen(false);
      fetchCategories();
      // The open category's own name may have just changed, so refresh the header too.
      if (selected && editId === selected.id) {
        setSelected({ ...selected, ...form });
      }
    } catch (err) {
      notify(err.response?.data?.message || 'Save failed', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteComponentCategory(deleteTarget.id);
      notify('Category deleted');
      setDeleteTarget(null);
      if (selected?.id === deleteTarget.id) setSelected(null);
      fetchCategories();
    } catch (err) {
      // The server refuses while components still reference the category, and its message
      // says how many — surfacing it verbatim is more useful than a generic failure.
      notify(err.response?.data?.message || 'Delete failed', 'error');
      setDeleteTarget(null);
    }
  };

  /**
   * Adds a component straight into the open category.
   *
   * Handing the category over in navigation state lets the Components page open its own
   * create dialog with the category preselected, instead of duplicating that whole form —
   * one component form, reachable from either screen.
   */
  const addComponentToCategory = () => {
    navigate('/components', { state: { createInCategoryId: selected.id } });
  };

  const openCategory = (category) => {
    setSelected(category);
    setPage(0);
  };

  const componentColumns = [
    { field: 'componentName', headerName: 'Name' },
    {
      field: 'rackNo', headerName: 'Rack No',
      render: (row) => (row.rackNo
        ? <Box component="span" sx={{ fontWeight: 600, color: colors.primary }}>{row.rackNo}</Box>
        : <Box component="span" sx={{ color: colors.textMuted }}>—</Box>),
    },
    {
      field: 'quantity', headerName: 'Quantity', align: 'right',
      render: (row) => (
        <Box component="span" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {Number(row.quantity || 0).toLocaleString()}
        </Box>
      ),
    },
    { field: 'unit', headerName: 'Unit', render: (row) => row.unit || '—' },
    { field: 'location', headerName: 'Location', render: (row) => row.location || '—' },
  ];

  // ---- Category contents -------------------------------------------------------------
  if (selected) {
    return (
      <Box>
        <PageHeader
          title={selected.name}
          subtitle={selected.description || 'Components filed under this category.'}
          icon={CircuitBoard}
          breadcrumbs={[
            { label: 'Manage' },
            { label: 'Component Categories' },
            { label: selected.name },
          ]}
          actions={(
            <>
              <Button
                variant="text" startIcon={<ArrowLeft size={16} />}
                onClick={() => setSelected(null)}
              >
                All categories
              </Button>
              {writeAccess && (
                <Button variant="contained" startIcon={<Plus size={16} />} onClick={addComponentToCategory}>
                  Add Component
                </Button>
              )}
            </>
          )}
        />

        <DataTable
          columns={componentColumns}
          rows={components}
          loading={componentsLoading}
          page={page}
          rowsPerPage={size}
          totalElements={total}
          onPageChange={setPage}
          onRowsPerPageChange={(s) => { setSize(s); setPage(0); }}
          emptyState={{
            icon: Package,
            title: `No components in ${selected.name}`,
            description: writeAccess
              ? 'Add the first component to this category.'
              : 'Nothing has been filed under this category yet.',
            actionLabel: writeAccess ? 'Add Component' : undefined,
            onAction: writeAccess ? addComponentToCategory : undefined,
          }}
        />
      </Box>
    );
  }

  // ---- Category grid -----------------------------------------------------------------
  return (
    <Box>
      <PageHeader
        title="Component Categories"
        subtitle="Group components by type — resistors, capacitors, ICs — and open a category to see what is in it."
        icon={LayoutGrid}
        breadcrumbs={[{ label: 'Manage' }, { label: 'Component Categories' }]}
        actions={(
          <>
            <SearchBar
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search categories…"
              width={220}
              sx={{ display: { xs: 'none', sm: 'flex' } }}
            />
            {writeAccess && (
              <Button variant="contained" startIcon={<Plus size={16} />} onClick={openCreate}>
                Add Category
              </Button>
            )}
          </>
        )}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress size={28} /></Box>
      ) : visibleCategories.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title={keyword ? 'No matching categories' : 'No categories yet'}
          description={keyword
            ? 'Try a different search term.'
            : 'Create a category to start grouping components.'}
          actionLabel={writeAccess && !keyword ? 'Add Category' : undefined}
          onAction={writeAccess && !keyword ? openCreate : undefined}
        />
      ) : (
        <Grid container spacing={2}>
          {visibleCategories.map((category) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={category.id}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%', display: 'flex', flexDirection: 'column',
                  transition: 'border-color .2s, box-shadow .2s',
                  '&:hover': { borderColor: colors.primary, boxShadow: '0 4px 14px rgba(0,0,0,.06)' },
                }}
              >
                <CardActionArea
                  onClick={() => openCategory(category)}
                  sx={{ flexGrow: 1, p: 2, alignItems: 'flex-start', textAlign: 'left' }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
                    <Box sx={{
                      width: 34, height: 34, borderRadius: '9px', display: 'grid', placeItems: 'center',
                      bgcolor: colors.primarySoft, color: colors.primary, flexShrink: 0,
                    }}
                    >
                      <CircuitBoard size={17} />
                    </Box>
                    <Typography sx={{ fontWeight: 650, fontSize: '0.9375rem', minWidth: 0 }} noWrap>
                      {category.name}
                    </Typography>
                  </Box>
                  <Typography
                    sx={{
                      fontSize: '0.8125rem', color: colors.textMuted, minHeight: 38,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {category.description || 'No description'}
                  </Typography>
                  <Chip
                    size="small"
                    label={`${Number(category.componentCount || 0).toLocaleString()} component${
                      Number(category.componentCount) === 1 ? '' : 's'}`}
                    sx={{ mt: 1.25, bgcolor: '#F2F1EE', color: colors.textSecondary, fontWeight: 600 }}
                  />
                </CardActionArea>

                {writeAccess && (
                  <Box sx={{
                    display: 'flex', justifyContent: 'flex-end', gap: 0.5,
                    px: 1, py: 0.5, borderTop: `1px solid ${colors.border}`,
                  }}
                  >
                    <Tooltip title="Rename">
                      <IconButton size="small" onClick={() => openEdit(category)}>
                        <Pencil size={15} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small" sx={{ color: colors.danger }}
                        onClick={() => setDeleteTarget(category)}
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editId ? 'Rename Category' : 'Add Category'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                label="Category Name" fullWidth required autoFocus
                placeholder="e.g. Resistor"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description" fullWidth multiline rows={2}
                placeholder="Optional"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name.trim()}>Save</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Category"
        message={deleteTarget
          ? `Delete "${deleteTarget.name}"? Categories still holding components cannot be deleted.`
          : ''}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <Snackbar
        open={snack.open} autoHideDuration={4000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack({ ...snack, open: false })}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ComponentCategoriesPage;
