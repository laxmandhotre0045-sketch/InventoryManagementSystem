import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Button, Card,
  IconButton, TextField, MenuItem, Snackbar, Alert, Grid, Tooltip, Chip, InputAdornment,
} from '@mui/material';
import {
  Plus, Pencil, Trash2, RotateCcw, Filter, X, AlertTriangle, CircuitBoard, Search, Eye, FolderInput,
} from 'lucide-react';
import {
  getComponents, deleteComponent, restoreComponent, getLowStockComponents,
} from '../api/componentApi';
import { getComponentCategories } from '../api/componentCategoryApi';
import { useAuth } from '../auth/AuthContext';
import { canWrite } from '../utils/roleUtils';
import DataTable from '../components/common/DataTable';
import ConfirmDialog from '../components/common/ConfirmDialog';
import ComponentDetailsDrawer from '../components/components/ComponentDetailsDrawer';
import ComponentFormDialog from '../components/components/ComponentFormDialog';
import MoveComponentsDialog from '../components/components/MoveComponentsDialog';
import { PageHeader, StatusBadge } from '../components/ui';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { formatCurrency as currency } from '../utils/currency';
import { colors } from '../theme/tokens';

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
  const navigate = useNavigate();
  const routerLocation = useLocation();
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
  // Row being edited in the form dialog (null = creating), and prefill for a new one.
  const [editRow, setEditRow] = useState(null);
  const [createDefaults, setCreateDefaults] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  // Row whose details/specifications drawer is open.
  const [detail, setDetail] = useState(null);
  // Component being moved to another Category › Type › Value.
  const [moveRow, setMoveRow] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [categories, setCategories] = useState([]);

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

  // A voice command (from the navbar mic) can add/remove/create stock while this
  // page is open — reload so the table reflects it without a manual refresh.
  useEffect(() => {
    const onChanged = () => refresh();
    window.addEventListener('inventory:changed', onChanged);
    return () => window.removeEventListener('inventory:changed', onChanged);
  }, [refresh]);

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

  /**
   * "Add Component" pressed from inside a category on the Categories page.
   *
   * That screen hands the category over in navigation state rather than duplicating this
   * form, so arriving with it means: filter to that category and open the create dialog
   * with it preselected. The state is cleared immediately so a later back-navigation or
   * refresh does not reopen the dialog.
   */
  const createInCategoryId = routerLocation.state?.createInCategoryId;
  useEffect(() => {
    if (!createInCategoryId) return;
    // Only preselect the category in the create form — the page itself no longer
    // filters by category (the rail is gone), so the list keeps showing everything.
    setEditRow(null);
    setCreateDefaults({ categoryId: createInCategoryId });
    setDialogOpen(true);
    navigate(routerLocation.pathname, { replace: true, state: null });
  }, [createInCategoryId, navigate, routerLocation.pathname]);

  const openCreate = () => {
    setEditRow(null);
    setCreateDefaults(null);
    setDialogOpen(true);
  };
  const openEdit = (row) => {
    setEditRow(row);
    setDialogOpen(true);
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

  // The generated item code (C0001, C0002, …) is deliberately absent from this table.
  // It is still generated, still stored, still unique and still matched by the search
  // box — it simply is not what anyone on the floor uses to find a part. Rack no takes
  // its place because that is the label that says where the component physically is.
  const columns = [
    {
      field: 'componentName', headerName: 'Name',
      render: (row) => (
        <Box component="button" type="button" onClick={() => setDetail(row)}
          sx={{ all: 'unset', cursor: 'pointer', fontWeight: 600, '&:hover': { color: colors.primary, textDecoration: 'underline' } }}>
          {row.componentName}
        </Box>
      ),
    },
    {
      field: 'rackNo', headerName: 'Rack No',
      render: (row) => (row.rackNo
        ? (
          <Box component="span" sx={{ fontWeight: 600, whiteSpace: 'nowrap', color: colors.primary }}>
            {row.rackNo}
          </Box>
        )
        : <Box component="span" sx={{ color: colors.textMuted }}>—</Box>),
    },
    { field: 'category', headerName: 'Category', render: (row) => row.category || <Box component="span" sx={{ color: colors.textMuted }}>—</Box> },
    { field: 'type', headerName: 'Type', render: (row) => row.type || <Box component="span" sx={{ color: colors.textMuted }}>—</Box> },
    { field: 'value', headerName: 'Value', render: (row) => row.value || <Box component="span" sx={{ color: colors.textMuted }}>—</Box> },
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

      {/* The category rail was removed: category browsing now lives on the dedicated
          Component Categories page, which drills Category → Type → Value. */}

      <Card sx={{ p: 2, mb: 2.5 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4.5}>
            <TextField label="Search components" size="small" fullWidth value={keyword}
              placeholder="Any words — name, type, value, category, rack…"
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
            <Tooltip title="Details & specifications">
              <IconButton size="small" onClick={() => setDetail(row)}><Eye size={16} /></IconButton>
            </Tooltip>
            <Tooltip title="Edit">
              <span>
                <IconButton size="small" onClick={() => openEdit(row)} disabled={!writeAccess}><Pencil size={16} /></IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Move to another folder">
              <span>
                <IconButton size="small" sx={{ color: colors.primary }} onClick={() => setMoveRow(row)} disabled={!writeAccess}>
                  <FolderInput size={16} />
                </IconButton>
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

      <ComponentFormDialog
        open={dialogOpen} onClose={() => setDialogOpen(false)}
        component={editRow} initialValues={createDefaults}
        categories={categories} canCreateCategory={writeAccess}
        onCategoryCreated={fetchCategories}
        notify={(message, severity = 'success') => setSnack({ open: true, message, severity })}
        onSaved={(message) => { setSnack({ open: true, message, severity: 'success' }); setDialogOpen(false); refresh(); }}
      />

      <ComponentDetailsDrawer
        component={detail} open={!!detail} onClose={() => setDetail(null)} canEdit={writeAccess}
        onEdit={(row) => { setDetail(null); openEdit(row); }}
        onRelocate={(row) => { setDetail(null); setMoveRow(row); }}
        onMoved={(r) => {
          setDetail(null);
          setSnack({
            open: true, severity: 'success',
            message: `Moved to Equipment as ${r.equipmentCodes.length > 1 ? `${r.equipmentCodes[0]} – ${r.equipmentCodes[r.equipmentCodes.length - 1]}` : r.equipmentCodes[0]}; ${r.componentItemCode} archived`,
          });
          refresh();
        }}
      />

      <MoveComponentsDialog
        open={!!moveRow} onClose={() => setMoveRow(null)} items={moveRow ? [moveRow] : []}
        categories={categories}
        onMoved={(count, path) => {
          setMoveRow(null);
          setSnack({ open: true, severity: 'success', message: `Moved${path ? ` to ${path}` : ''}` });
          refresh();
        }}
      />

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
