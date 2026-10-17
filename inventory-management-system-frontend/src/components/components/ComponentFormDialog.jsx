import { useEffect, useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, TextField, Typography,
} from '@mui/material';
import { Plus } from 'lucide-react';
import { createComponent, updateComponent } from '../../api/componentApi';
import { createComponentCategory } from '../../api/componentCategoryApi';
import { formatCurrency as currency, CURRENCY_SYMBOL } from '../../utils/currency';
import { colors } from '../../theme/tokens';

const emptyForm = {
  componentName: '', categoryId: '', type: '', value: '', quantity: 0, minimumQuantity: 0, unitPrice: '',
  location: '', rackNo: '', status: 'ACTIVE', description: '',
};

// Sentinel value for the "create a new category" row in the category dropdown.
// Not a valid id, so it can never be mistaken for a real selection.
const NEW_CATEGORY = '__new__';

// Two states only. ARCHIVED still exists in the data model to back the soft delete,
// but it is set by the archive/restore actions — never chosen from this list.
const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Available' },
  { value: 'INACTIVE', label: 'Not Available' },
];

const formFromRow = (row) => ({
  // itemCode is still carried so the "never send it back" guard in handleSave has
  // something to strip; it is simply not shown.
  itemCode: row.itemCode || '',
  componentName: row.componentName || '', categoryId: row.categoryId ?? '',
  type: row.type || '', value: row.value || '',
  quantity: row.quantity ?? 0, minimumQuantity: row.minimumQuantity ?? 0,
  unitPrice: row.unitPrice ?? '', location: row.location || '',
  rackNo: row.rackNo || '',
  status: row.status || 'ACTIVE', description: row.description || '',
});

/**
 * The add/edit component form, shared by the Components page and the Category › Type ›
 * Value drill-down so both save through exactly the same fields and checks.
 *
 * component         — the row to edit, or null to create
 * initialValues     — prefill for a new component (e.g. { categoryId })
 * categories        — the category list for the dropdown
 * onCategoryCreated — called after a category is created here so the parent reloads the list
 * onSaved(message, saved) — after a successful save (saved = the component as stored);
 *                    notify(message, severity) for everything else
 */
const ComponentFormDialog = ({
  open, onClose, component, initialValues, categories, canCreateCategory,
  onCategoryCreated, onSaved, notify,
}) => {
  const editId = component?.id ?? null;
  const [form, setForm] = useState(emptyForm);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  // Fill the form each time the dialog opens, for whichever row (or new item) it is for.
  useEffect(() => {
    if (!open) return;
    setForm(component ? formFromRow(component) : { ...emptyForm, ...(initialValues || {}) });
  }, [open, component, initialValues]);

  /** The category the open form will save into. */
  const formCategory = categories.find((c) => c.id === Number(form.categoryId)) || null;

  // Either nothing is chosen yet, or a category has been picked in the form.
  let categoryHelperText = ' ';
  if (form.categoryId === '') {
    categoryHelperText = 'Required — choose the category this component belongs to.';
  }

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
      notify('Category name is required', 'error');
      return;
    }
    setSavingCategory(true);
    try {
      const res = await createComponentCategory({ name });
      const created = res.data;
      await onCategoryCreated?.();
      // Select it straight away — creating it from inside the form means it is the
      // one the user wants for the component they are entering.
      setForm((prev) => ({ ...prev, categoryId: created?.id ?? '' }));
      setNewCategoryOpen(false);
      notify(`Category "${created?.name || name}" created`);
    } catch (err) {
      notify(err.response?.data?.message || 'Could not create category', 'error');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleSave = async () => {
    // Caught here as well as by the backend so the user gets the message beside the
    // form rather than a validation error after a round trip.
    if (form.categoryId === '' || form.categoryId == null) {
      notify('Please select a category', 'error');
      return;
    }
    // Type and Value complete the Category → Type → Value structure and are required
    // for every component entered through the app.
    if (!form.type.trim()) {
      notify('Please enter a Type (e.g. SMD, axial)', 'error');
      return;
    }
    if (!form.value.trim()) {
      notify('Please enter a Value (e.g. 4.7kΩ, 100µF)', 'error');
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
      // Named in the confirmation so a component landing somewhere other than the
      // category on screen is visible rather than silent.
      const savedIn = categories.find((c) => c.id === Number(form.categoryId))?.name;
      if (editId) {
        const res = await updateComponent(editId, payload);
        onSaved(`Component updated in ${savedIn}`, res?.data);
      } else {
        const res = await createComponent(payload);
        onSaved(`Component created in ${savedIn}`, res?.data);
      }
    } catch (err) {
      notify(err.response?.data?.message || 'Save failed', 'error');
    }
  };

  return (
    <>
      <Dialog open={open} onClose={() => onClose()} maxWidth="sm" fullWidth>
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
            {/* The read-only Item Code field was removed with the column: the value is
                system-generated, uneditable, and of no use while filling this form in.
                It is still assigned on save and still stored. */}
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
                {canCreateCategory && (
                  <MenuItem
                    value={NEW_CATEGORY}
                    sx={{ color: colors.primary, fontWeight: 600, borderTop: `1px solid ${colors.border}`, mt: 0.5 }}
                  >
                    <Plus size={15} style={{ marginRight: 8 }} /> Create new category…
                  </MenuItem>
                )}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Type" fullWidth required
                placeholder="e.g. SMD, axial, ceramic"
                inputProps={{ maxLength: 100 }}
                error={form.type.trim() === ''}
                helperText="The sub-type within the category (Category → Type → Value)."
                value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Value" fullWidth required
                placeholder="e.g. 4.7kΩ, 100µF, 16MHz"
                inputProps={{ maxLength: 100 }}
                error={form.value.trim() === ''}
                helperText="The specific value within the type."
                value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Rack No" fullWidth placeholder="e.g. 12, A12, RACK-A, B-04"
                inputProps={{ maxLength: 50 }}
                helperText="Numbers or text — entered by you, not generated."
                value={form.rackNo} onChange={(e) => setForm({ ...form, rackNo: e.target.value })}
              />
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
          <Button variant="text" onClick={() => onClose()}>Cancel</Button>
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
    </>
  );
};

export default ComponentFormDialog;
