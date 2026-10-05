import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Breadcrumbs, Button, Card, CardActionArea, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Grid, IconButton, Link, Snackbar,
  TextField, Tooltip, Typography,
} from '@mui/material';
import {
  ArrowLeft, ChevronRight, CircuitBoard, Layers, LayoutGrid, Package, Pencil, Plus, Tag, Trash2,
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

// Labels for components entered before Type/Value existed (null), so they still appear
// in the drill-down instead of silently dropping out of the tree.
const UNSPECIFIED_TYPE = 'Unspecified type';
const UNSPECIFIED_VALUE = 'Unspecified value';

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

  // Drill-down position inside the category section:
  //   selected === null                          → the category grid
  //   selected set, selectedType === null        → the Types in that category
  //   selectedType set, selectedValue === null   → the Values of that type
  //   selectedValue set                          → the components at that Category→Type→Value
  const [selected, setSelected] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedValue, setSelectedValue] = useState(null);
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
      // Fetch the whole category in one request so it can be grouped Type → Value below.
      // A category holds at most a few hundred parts, so 500 covers it without paging.
      const res = await getComponents({
        categoryId: selected.id, page: 0, size: 500, sortBy: 'componentName', sortDir: 'asc',
      });
      setComponents(res.data?.content || []);
      setTotal(res.data?.totalElements || 0);
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to load components', 'error');
    } finally {
      setComponentsLoading(false);
    }
  }, [selected]);

  useEffect(() => { fetchComponents(); }, [fetchComponents]);

  /**
   * Category → Type → Value. The selected category's components, grouped by Type and,
   * within each type, ordered by Value then Name. Components entered before Type/Value
   * existed (null) gather under "Unspecified type" so the real data already in the system
   * stays visible rather than disappearing from the view.
   */
  const groupedByType = useMemo(() => {
    const groups = new Map();
    components.forEach((c) => {
      const key = (c.type && c.type.trim()) || UNSPECIFIED_TYPE;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    });
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    return [...groups.entries()]
      .sort((a, b) => collator.compare(a[0], b[0]))
      .map(([type, rows]) => [
        type,
        [...rows].sort((x, y) => collator.compare(String(x.value || ''), String(y.value || ''))
          || collator.compare(x.componentName || '', y.componentName || '')),
      ]);
  }, [components]);

  // The rows of the type currently drilled into (empty until one is picked).
  const rowsOfSelectedType = useMemo(() => {
    if (selectedType == null) return [];
    const entry = groupedByType.find(([t]) => t === selectedType);
    return entry ? entry[1] : [];
  }, [groupedByType, selectedType]);

  // Level 1 — the Types in the selected category, each with its value/item counts.
  const typeCards = useMemo(() => groupedByType.map(([type, rows]) => {
    const values = new Set(rows.map((c) => (c.value && c.value.trim()) || UNSPECIFIED_VALUE));
    return {
      key: type,
      label: type,
      subtitle: `${values.size} value${values.size === 1 ? '' : 's'} · ${rows.length} item${rows.length === 1 ? '' : 's'}`,
    };
  }), [groupedByType]);

  // Level 2 — the Values of the drilled-into type, each with its item count.
  const valueCards = useMemo(() => {
    const map = new Map();
    rowsOfSelectedType.forEach((c) => {
      const key = (c.value && c.value.trim()) || UNSPECIFIED_VALUE;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    });
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    return [...map.entries()]
      .sort((a, b) => collator.compare(a[0], b[0]))
      .map(([value, rows]) => ({
        key: value,
        label: value,
        subtitle: `${rows.length} item${rows.length === 1 ? '' : 's'}`,
      }));
  }, [rowsOfSelectedType]);

  // Level 3 — the components at the selected Category → Type → Value.
  const leafComponents = useMemo(() => {
    if (selectedValue == null) return [];
    return rowsOfSelectedType.filter(
      (c) => ((c.value && c.value.trim()) || UNSPECIFIED_VALUE) === selectedValue);
  }, [rowsOfSelectedType, selectedValue]);

  const openType = (type) => { setSelectedType(type); setSelectedValue(null); };
  const openValue = (value) => setSelectedValue(value);
  const backToCategories = () => { setSelected(null); setSelectedType(null); setSelectedValue(null); };
  const backToTypes = () => { setSelectedType(null); setSelectedValue(null); };
  const backToValues = () => setSelectedValue(null);

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
    setSelectedType(null);
    setSelectedValue(null);
    setPage(0);
  };

  // Columns for the leaf table (one Category → Type → Value). Value and Type are both
  // in the breadcrumb path above, so the table itself need not repeat them.
  const leafColumns = [
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

  // ---- Category → Type → Value drill-down --------------------------------------------
  if (selected) {
    // Where we are in the drill decides the heading, the Back target, and the content.
    const atValue = selectedValue != null;
    const atType = selectedType != null;
    const title = atValue ? selectedValue : atType ? selectedType : selected.name;
    const subtitle = atValue
      ? `${selected.name} › ${selectedType}`
      : atType
        ? `Values of ${selectedType} — pick one to see its components.`
        : (selected.description || 'Pick a type to drill in: Type → Value → components.');
    const back = atValue
      ? { label: 'Back to values', onClick: backToValues }
      : atType
        ? { label: 'Back to types', onClick: backToTypes }
        : { label: 'All categories', onClick: backToCategories };

    const crumbLink = (label, onClick) => (
      <Link
        component="button" type="button" onClick={onClick} underline="hover"
        sx={{ color: colors.textMuted, fontSize: '0.8125rem', fontWeight: 500 }}
      >
        {label}
      </Link>
    );
    const crumbCurrent = (label) => (
      <Typography sx={{ color: colors.textSecondary, fontSize: '0.8125rem', fontWeight: 600 }}>{label}</Typography>
    );

    // A grid of clickable cards — reused for the Types level and the Values level.
    const drillGrid = (items, onOpen, Icon) => (
      <Grid container spacing={2}>
        {items.map((it) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={it.key}>
            <Card
              variant="outlined"
              sx={{
                height: '100%', transition: 'border-color .2s, box-shadow .2s',
                '&:hover': { borderColor: colors.primary, boxShadow: '0 4px 14px rgba(0,0,0,.06)' },
              }}
            >
              <CardActionArea
                onClick={() => onOpen(it.key)}
                sx={{ p: 2, height: '100%', alignItems: 'flex-start', textAlign: 'left' }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
                  <Box sx={{
                    width: 34, height: 34, borderRadius: '9px', display: 'grid', placeItems: 'center',
                    bgcolor: colors.primarySoft, color: colors.primary, flexShrink: 0,
                  }}
                  >
                    <Icon size={17} />
                  </Box>
                  <Typography sx={{ fontWeight: 650, fontSize: '0.9375rem', minWidth: 0 }} noWrap>{it.label}</Typography>
                </Box>
                <Chip
                  size="small" label={it.subtitle}
                  sx={{ bgcolor: '#F2F1EE', color: colors.textSecondary, fontWeight: 600 }}
                />
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    );

    return (
      <Box>
        <PageHeader
          title={title}
          subtitle={subtitle}
          icon={CircuitBoard}
          breadcrumbs={[{ label: 'Manage' }, { label: 'Component Categories' }]}
          actions={(
            <>
              <Button variant="text" startIcon={<ArrowLeft size={16} />} onClick={back.onClick}>
                {back.label}
              </Button>
              {writeAccess && (
                <Button variant="contained" startIcon={<Plus size={16} />} onClick={addComponentToCategory}>
                  Add Component
                </Button>
              )}
            </>
          )}
        />

        {/* Clickable path: every level above the current one jumps straight back to it. */}
        <Breadcrumbs separator={<ChevronRight size={12} color={colors.textMuted} />} sx={{ mb: 2 }}>
          {crumbLink('All categories', backToCategories)}
          {atType ? crumbLink(selected.name, backToTypes) : crumbCurrent(selected.name)}
          {atType && (atValue ? crumbLink(selectedType, backToValues) : crumbCurrent(selectedType))}
          {atValue && crumbCurrent(selectedValue)}
        </Breadcrumbs>

        {componentsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress size={26} /></Box>
        ) : components.length === 0 ? (
          <EmptyState
            icon={Package}
            title={`No components in ${selected.name}`}
            description={writeAccess
              ? 'Add the first component to this category.'
              : 'Nothing has been filed under this category yet.'}
            actionLabel={writeAccess ? 'Add Component' : undefined}
            onAction={writeAccess ? addComponentToCategory : undefined}
          />
        ) : !atType ? (
          // Level 1 — Types in this category.
          drillGrid(typeCards, openType, Layers)
        ) : !atValue ? (
          // Level 2 — Values of the chosen type.
          drillGrid(valueCards, openValue, Tag)
        ) : (
          // Level 3 — components at this Category → Type → Value.
          <DataTable columns={leafColumns} rows={leafComponents} rowKey="id" minWidth={560} />
        )}
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
