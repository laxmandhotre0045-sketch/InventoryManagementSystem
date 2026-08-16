import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Button, Card, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, TextField, MenuItem, Snackbar, Alert, Grid, Tooltip, Chip, InputAdornment, Typography,
} from '@mui/material';
import { Plus, Pencil, Trash2, RotateCcw, Filter, X, AlertTriangle, CircuitBoard, Search, Layers } from 'lucide-react';
import {
  getComponents, createComponent, updateComponent, deleteComponent, restoreComponent, getLowStockComponents,
} from '../api/componentApi';
import { getComponentCategories, createComponentCategory } from '../api/componentCategoryApi';
import { useAuth } from '../auth/AuthContext';
import { canWrite } from '../utils/roleUtils';
import DataTable from '../components/common/DataTable';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { PageHeader, StatusBadge } from '../components/ui';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { formatCurrency as currency, CURRENCY_SYMBOL } from '../utils/currency';
import { colors } from '../theme/tokens';

const emptyForm = {
  componentName: '', categoryId: '', quantity: 0, minimumQuantity: 0, unitPrice: '',
  location: '', status: 'ACTIVE', description: '',
};

// Sentinel value for the "create a new category" row in the category dropdown.
// Not a valid id, so it can never be mistaken for a real selection.
const NEW_CATEGORY = '__new__';

/**
 * Selected category reads as a filled brand pill; the rest stay quiet outlines.
 * Selection has to survive a glance across a dozen chips, so it carries colour,
 * weight and border together rather than relying on any one of them.
 */
const chipSx = (selected) => ({
  fontWeight: selected ? 700 : 500,
  fontSize: '0.75rem',
  cursor: 'pointer',
  bgcolor: selected ? colors.primary : colors.paper,
  color: selected ? colors.textInverse : colors.textSecondary,
  border: `1px solid ${selected ? colors.primary : colors.border}`,
  '&:hover': { bgcolor: selected ? colors.primaryHover : colors.primarySoft },
});

/** "Resistor (4)", or just "Resistor" until the count has loaded. */
const categoryLabel = (c) => (c.componentCount == null ? c.name : `${c.name} (${c.componentCount})`);

// Two states only. ARCHIVED still exists in the data model to back the soft delete,
// but it is set by the archive/restore actions — never chosen from this list.
const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Available' },
  { value: 'INACTIVE', label: 'Not Available' },
];

/**
 * Availability is binary: in stock and active, or not.
 *
 * Running low is not a third state here — it shows as the amber warning beside the
 * quantity and drives the low-stock chip and dashboard alerts, so a nearly-empty
 * component still reads as Available, which is what it is.
 */
const availabilityOf = (row) =>
  (row.quantity > 0 && row.status === 'ACTIVE' ? 'available' : 'not_available');

const ComponentsPage = () => {
  const { role } = useAuth();
  const writeAccess = canWrite(role);
  // The navbar's global search lands here as ?q=… — seed the filter from it.
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState(() => searchParams.get('q') || '');
  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('');
  const [stockStatus, setStockStatus] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [categories, setCategories] = useState([]);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Item code ascending is the default order and stays that way through
      // searching, filtering and paging — the backend applies it to the whole
      // matching set, so page 2 continues where page 1 left off.
      const params = {
        page, size, sortBy: 'itemCode', sortDir: 'asc',
        keyword: debouncedKeyword.trim(), status, stockStatus,
      };
      // Omitted entirely when "All categories" is selected: the backend types this
      // parameter as a number, so sending an empty string would be a bad request
      // rather than "no filter".
      if (categoryId !== '') {
        params.categoryId = categoryId;
      }
      // API responses are wrapped in an ApiResponse envelope: { success, message, data }.
      // The paged payload lives at res.data.{content,totalElements}.
      const res = await getComponents(params);
      setRows(res.data?.content || []);
      setTotal(res.data?.totalElements || 0);
      const ls = await getLowStockComponents();
      setLowStock(ls.data || []);
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Failed to load components', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, size, debouncedKeyword, categoryId, status, stockStatus]);

  // Categories change far less often than the component list, so they load once
  // rather than on every filter change. Refreshed explicitly after one is created.
  const fetchCategories = useCallback(async () => {
    try {
      const res = await getComponentCategories();
      setCategories(res.data || []);
    } catch {
      // Non-fatal: the component list still renders. The dropdown falls back to its
      // empty state, which the form reports as "no categories yet".
      setCategories([]);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  /**
   * Anything that changes which components exist changes the per-category counts
   * on the rail too, so the two are always reloaded together. Without this the
   * chips keep showing the figures from page load and slowly drift out of date.
   */
  const refresh = useCallback(() => { fetchData(); fetchCategories(); }, [fetchData, fetchCategories]);
  // Reset to the first page whenever the (debounced) search term changes.
  useEffect(() => { setPage(0); }, [debouncedKeyword]);

  // Pick up a term handed over by the navbar's global search, including when this
  // page is already mounted. The param is consumed so a later manual edit to the
  // field isn't overwritten and the URL stays clean.
  const queryParam = searchParams.get('q');
  useEffect(() => {
    if (queryParam === null) return;
    setKeyword(queryParam);
    setSearchParams({}, { replace: true });
  }, [queryParam, setSearchParams]);

  /** The category currently being browsed, or null when showing all. */
  const activeCategory = categories.find((c) => c.id === categoryId) || null;

  // Sum of the per-category counts rather than the page's total: it has to stay
  // right while a category filter is narrowing the list below it.
  const totalInCategories = categories.reduce((sum, c) => sum + (c.componentCount || 0), 0);

  /** The category the open form will save into. */
  const formCategory = categories.find((c) => c.id === Number(form.categoryId)) || null;

  // Says which of the three states the field is in: nothing chosen yet, carried in
  // from the category being browsed, or picked deliberately. The inherited case is
  // called out because it is the one the user did not type — it should be obvious
  // it can be changed, not something noticed only after saving.
  let categoryHelperText = ' ';
  if (form.categoryId === '') {
    categoryHelperText = 'Required — choose the category this component belongs to.';
  } else if (!editId && activeCategory && Number(form.categoryId) === activeCategory.id) {
    categoryHelperText = `From the ${activeCategory.name} category you are viewing. Change it here if needed.`;
  }

  const selectCategory = (value) => { setCategoryId(value); setPage(0); };

  /**
   * A new component inherits the category being browsed.
   *
   * <p>Adding a resistor is almost always something you do while looking at the
   * resistors, so pre-selecting the filtered category saves the step and stops a
   * component from quietly landing in the wrong place. It is a default, not a
   * constraint — the form still shows the field and it can be changed before saving.
   * With "All Categories" selected there is nothing to inherit, so the field starts
   * empty and must be filled in.</p>
   */
  const openCreate = () => {
    setEditId(null);
    setForm({ ...emptyForm, categoryId: activeCategory ? activeCategory.id : '' });
    setDialogOpen(true);
  };
  const openEdit = (row) => {
    setEditId(row.id);
    setForm({
      itemCode: row.itemCode || '',
      componentName: row.componentName || '', categoryId: row.categoryId ?? '',
      quantity: row.quantity ?? 0, minimumQuantity: row.minimumQuantity ?? 0,
      unitPrice: row.unitPrice ?? '', location: row.location || '',
      status: row.status || 'ACTIVE', description: row.description || '',
    });
    setDialogOpen(true);
  };

  /**
   * The category select doubles as the entry point for creating one, so an admin who
   * finds the category missing mid-entry can add it without losing the form they are
   * part-way through filling in.
   */
  const handleCategoryChange = (value) => {
    if (value === NEW_CATEGORY) {
      setNewCategoryName('');
      setNewCategoryOpen(true);
      return;
    }
    setForm((prev) => ({ ...prev, categoryId: value }));
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      setSnack({ open: true, message: 'Category name is required', severity: 'error' });
      return;
    }
    setSavingCategory(true);
    try {
      const res = await createComponentCategory({ name });
      const created = res.data;
      await fetchCategories();
      // Select it straight away — creating it from inside the form means it is the
      // one the user wants for the component they are entering.
      setForm((prev) => ({ ...prev, categoryId: created?.id ?? '' }));
      setNewCategoryOpen(false);
      setSnack({ open: true, message: `Category "${created?.name || name}" created`, severity: 'success' });
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Could not create category', severity: 'error' });
    } finally {
      setSavingCategory(false);
    }
  };

  const handleSave = async () => {
    // Caught here as well as by the backend so the user gets the message beside the
    // form rather than a validation error after a round trip.
    if (form.categoryId === '' || form.categoryId == null) {
      setSnack({ open: true, message: 'Please select a category', severity: 'error' });
      return;
    }
    try {
      // itemCode is system-generated — never sent to the API.
      const payload = {
        ...form,
        categoryId: Number(form.categoryId),
        quantity: Number(form.quantity),
        minimumQuantity: Number(form.minimumQuantity),
        // Blank means "no price known", which is not the same as free. Sending null
        // keeps the component out of the valuation instead of valuing it at zero.
        unitPrice: form.unitPrice === '' || form.unitPrice === null ? null : Number(form.unitPrice),
      };
      delete payload.itemCode;
      // Named in the confirmation because the form's category can be changed after
      // it was inherited from the rail — this is what makes a component landing
      // somewhere other than the category on screen visible rather than silent.
      const savedIn = categories.find((c) => c.id === Number(form.categoryId))?.name;
      if (editId) {
        await updateComponent(editId, payload);
        setSnack({ open: true, message: `Component updated in ${savedIn}`, severity: 'success' });
      } else {
        await createComponent(payload);
        setSnack({ open: true, message: `Component created in ${savedIn}`, severity: 'success' });
      }
      setDialogOpen(false);
      refresh();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Save failed', severity: 'error' });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteComponent(deleteId);
      setSnack({ open: true, message: 'Component archived successfully', severity: 'success' });
      setDeleteId(null);
      refresh();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Delete failed', severity: 'error' });
    }
  };

  const handleRestore = async (id) => {
    try {
      await restoreComponent(id);
      setSnack({ open: true, message: 'Component restored successfully', severity: 'success' });
      refresh();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Restore failed', severity: 'error' });
    }
  };

  const resetFilters = () => {
    setKeyword(''); setCategoryId(''); setStatus(''); setStockStatus(''); setPage(0);
  };

  const columns = [
    {
      field: 'itemCode', headerName: 'Code',
      render: (row) => (
        <Box component="span" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: colors.primary, whiteSpace: 'nowrap' }}>
          {row.itemCode || '—'}
        </Box>
      ),
    },
    { field: 'componentName', headerName: 'Name' },
    { field: 'category', headerName: 'Category', render: (row) => row.category || <Box component="span" sx={{ color: colors.textMuted }}>—</Box> },
    {
      field: 'quantity', headerName: 'Quantity', align: 'right',
      render: (row) => (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.75 }}>
          {row.quantity <= row.minimumQuantity && (
            <Tooltip title="At or below minimum">
              <Box component="span" sx={{ display: 'inline-flex', color: colors.warning }}>
                <AlertTriangle size={16} />
              </Box>
            </Tooltip>
          )}
          <Box component="span" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{row.quantity.toLocaleString()}</Box>
        </Box>
      ),
    },
    { field: 'minimumQuantity', headerName: 'Min Qty', align: 'right', render: (row) => <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>{row.minimumQuantity.toLocaleString()}</Box> },
    {
      field: 'unitPrice', headerName: 'Unit Price', align: 'right',
      render: (row) => (row.unitPrice != null
        ? <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>{currency(row.unitPrice)}</Box>
        : (
          <Tooltip title="No price set — this component is excluded from the stock valuation">
            <Box component="span" sx={{ color: colors.warning, fontWeight: 600 }}>Not set</Box>
          </Tooltip>
        )),
    },
    {
      field: 'stockValue', headerName: 'Stock Value', align: 'right',
      render: (row) => (row.stockValue != null
        ? <Box component="span" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{currency(row.stockValue)}</Box>
        : <Box component="span" sx={{ color: colors.textMuted }}>—</Box>),
    },
    {
      field: 'status', headerName: 'Status',
      render: (row) => (row.status === 'ARCHIVED'
        ? <StatusBadge status="cancelled" label="Archived" />
        : <StatusBadge status={availabilityOf(row)} />),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Components"
        subtitle="Track parts, stock levels, and reorder thresholds."
        icon={CircuitBoard}
        breadcrumbs={[{ label: 'Manage' }, { label: 'Components' }]}
        actions={
          <>
            {lowStock.length > 0 && (
              <Chip
                icon={<AlertTriangle size={15} />}
                label={`${lowStock.length} low stock`}
                sx={{ bgcolor: colors.warningSoft, color: colors.warning, fontWeight: 600, '& .MuiChip-icon': { color: colors.warning } }}
              />
            )}
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={openCreate} disabled={!writeAccess}>
              Add Component
            </Button>
          </>
        }
      />

      {/* The category rail sits above the other filters because it is the primary way
          the catalogue is navigated — one click, no dropdown to open, and the current
          selection is legible at a glance rather than hidden inside a closed control. */}
      <Card sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          <Layers size={16} color={colors.textMuted} />
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 650 }}>Categories</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted }}>
            {activeCategory
              ? `Showing ${activeCategory.name} only`
              : 'Showing every category'}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          {writeAccess && (
            <Button size="small" variant="text" startIcon={<Plus size={15} />}
              onClick={() => { setNewCategoryName(''); setNewCategoryOpen(true); }}>
              New Category
            </Button>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={`All Categories (${totalInCategories})`}
            onClick={() => selectCategory('')}
            sx={chipSx(categoryId === '')}
          />
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={categoryLabel(c)}
              onClick={() => selectCategory(c.id)}
              sx={chipSx(categoryId === c.id)}
            />
          ))}
          {categories.length === 0 && (
            <Typography sx={{ fontSize: '0.8125rem', color: colors.textMuted }}>
              No categories yet. Create one to start organising components.
            </Typography>
          )}
        </Box>
      </Card>

      <Card sx={{ p: 2, mb: 2.5 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4.5}>
            <TextField label="Search components" size="small" fullWidth value={keyword}
              placeholder="Code, name, category, location…"
              onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchData()}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search size={17} color={colors.textMuted} /></InputAdornment> }} />
          </Grid>
          <Grid item xs={12} sm={6} md={2.5}>
            <TextField label="Status" size="small" fullWidth select value={status}
              onChange={(e) => setStatus(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="ACTIVE">Available</MenuItem>
              <MenuItem value="INACTIVE">Not Available</MenuItem>
              <MenuItem value="ARCHIVED">Archived</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={2.5}>
            {/* Stock level stays a separate filter: it answers "what needs reordering",
                which the binary status column deliberately no longer encodes. */}
            <TextField label="Stock level" size="small" fullWidth select value={stockStatus}
              onChange={(e) => setStockStatus(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="AVAILABLE">In stock</MenuItem>
              <MenuItem value="LOW_STOCK">Low stock</MenuItem>
              <MenuItem value="OUT_OF_STOCK">Out of stock</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={2.5} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 1.25 }}>
            <Button variant="contained" startIcon={<Filter size={17} />} onClick={() => { setPage(0); fetchData(); }}>Apply</Button>
            <Button variant="text" startIcon={<X size={17} />} onClick={resetFilters}>Reset</Button>
          </Grid>
        </Grid>
      </Card>

      <DataTable
        columns={columns} rows={rows} loading={loading} page={page} rowsPerPage={size}
        totalElements={total} onPageChange={setPage} onRowsPerPageChange={(s) => { setSize(s); setPage(0); }}
        emptyState={{
          icon: CircuitBoard,
          title: 'No components found',
          description: 'Add your first component or adjust your filters to see results.',
          actionLabel: writeAccess ? 'Add Component' : undefined,
          onAction: writeAccess ? openCreate : undefined,
        }}
        renderActions={(row) => (
          <Box sx={{ display: 'inline-flex', gap: 0.875 }}>
            <Tooltip title="Edit">
              <span>
                <IconButton size="small" onClick={() => openEdit(row)} disabled={!writeAccess}><Pencil size={16} /></IconButton>
              </span>
            </Tooltip>
            {row.status === 'ARCHIVED' ? (
              <Tooltip title="Restore">
                <IconButton size="small" sx={{ color: colors.primary }} onClick={() => handleRestore(row.id)}><RotateCcw size={16} /></IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="Archive">
                <span>
                  <IconButton size="small" sx={{ color: colors.danger }} onClick={() => setDeleteId(row.id)} disabled={!writeAccess}><Trash2 size={16} /></IconButton>
                </span>
              </Tooltip>
            )}
          </Box>
        )}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        {/* The title names the category so the destination is stated before the
            form is even read, not only in the field half way down it. */}
        <DialogTitle>
          {editId ? 'Edit Component' : 'Add Component'}
          {!editId && formCategory && (
            <Typography component="span" sx={{ color: colors.textSecondary, fontWeight: 500 }}>
              {' '}to {formCategory.name}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                label="Item Code" fullWidth disabled
                value={editId ? (form.itemCode || '—') : 'Generated automatically on save'}
                helperText="System-generated and cannot be edited."
              />
            </Grid>
            <Grid item xs={12}><TextField label="Component Name" fullWidth required value={form.componentName}
              onChange={(e) => setForm({ ...form, componentName: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select required fullWidth label="Category"
                value={form.categoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                error={form.categoryId === ''}
                helperText={categoryHelperText}
              >
                {categories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
                {writeAccess && (
                  <MenuItem
                    value={NEW_CATEGORY}
                    sx={{ color: colors.primary, fontWeight: 600, borderTop: `1px solid ${colors.border}`, mt: 0.5 }}
                  >
                    <Plus size={15} style={{ marginRight: 8 }} /> Create new category…
                  </MenuItem>
                )}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}><TextField label="Warehouse Location" fullWidth placeholder="e.g. Rack A-12 / Bin 04"
              value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}>
              <TextField select label="Status" fullWidth value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUS_OPTIONS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}><TextField label="Quantity" type="number" fullWidth required value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField label="Minimum Quantity" type="number" fullWidth required value={form.minimumQuantity}
              onChange={(e) => setForm({ ...form, minimumQuantity: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={`Unit Price (${CURRENCY_SYMBOL})`} type="number" fullWidth
                inputProps={{ min: 0, step: '0.01' }}
                value={form.unitPrice}
                onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                helperText={
                  form.unitPrice === '' || form.unitPrice === null
                    ? 'Without a price this component is excluded from the stock valuation.'
                    : `Stock value: ${currency(Number(form.unitPrice || 0) * Number(form.quantity || 0))}`
                }
              />
            </Grid>
            <Grid item xs={12}><TextField label="Description" fullWidth multiline rows={2} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Sits above the component dialog so the half-filled form is still there when
          this closes. Only the name is asked for — anything else is an extra field
          between the user and getting back to the component they were adding. */}
      <Dialog open={newCategoryOpen} onClose={() => setNewCategoryOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New Category</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth label="Category Name" sx={{ mt: 1 }}
            placeholder="e.g. Voltage Regulator"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !savingCategory) handleCreateCategory(); }}
            helperText="Must be unique. It will be selected for this component once created."
          />
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setNewCategoryOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateCategory} disabled={savingCategory}>
            {savingCategory ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteId} title="Archive Component"
        message="This component may have stock or project history. Archiving will hide it from new transactions while preserving existing records."
        onConfirm={handleDelete} onCancel={() => setDeleteId(null)} confirmText="Archive" />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack({ ...snack, open: false })}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default ComponentsPage;
