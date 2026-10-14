import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, TextField, Typography,
} from '@mui/material';
import { FolderInput, MapPin } from 'lucide-react';
import { getComponents, relocateComponents } from '../../api/componentApi';
import { colors } from '../../theme/tokens';

const clean = (s) => String(s || '').trim().replace(/\s+/g, ' ');
const sameText = (a, b) => clean(a).toLowerCase() === clean(b).toLowerCase();
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const uniqueSorted = (list) => [...new Set(list.map(clean).filter(Boolean))].sort(collator.compare);

/** The value every item shares, or '' when they differ. */
const common = (items, pick) => {
  const vals = [...new Set(items.map((i) => clean(pick(i))))];
  return vals.length === 1 ? vals[0] : '';
};

/**
 * Moves one or more components to another Category › Type › Value — for parts that were
 * filed in the wrong place. Only those three fields change; stock, price, rack and
 * history stay as they are.
 *
 * A field left empty keeps each component's own value, which is how a whole Type can be
 * renamed while every component in it keeps its own Value (keepValue starts Value empty).
 */
const MoveComponentsDialog = ({ open, onClose, items, categories, title, keepValue, onMoved }) => {
  const [category, setCategory] = useState('');
  const [type, setType] = useState('');
  const [value, setValue] = useState('');
  const [siblings, setSiblings] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setCategory(common(items, (i) => i.category));
    setType(common(items, (i) => i.type));
    setValue(keepValue ? '' : common(items, (i) => i.value));
    setError('');
  }, [open, items, keepValue]);

  const existingCategory = categories.find((c) => sameText(c.name, category)) || null;

  // Types and values already used in the chosen category, offered as suggestions so the
  // part lands in an existing folder instead of a near-duplicate ("SMD" vs "smd ").
  const categoryId = existingCategory?.id;
  useEffect(() => {
    if (!open || !categoryId) { setSiblings([]); return undefined; }
    let cancelled = false;
    getComponents({ categoryId, page: 0, size: 500 })
      .then((res) => { if (!cancelled) setSiblings(res.data?.content || []); })
      .catch(() => { if (!cancelled) setSiblings([]); });
    return () => { cancelled = true; };
  }, [open, categoryId]);

  const typeOptions = useMemo(() => uniqueSorted(siblings.map((c) => c.type)), [siblings]);
  const valueOptions = useMemo(
    () => uniqueSorted(siblings.filter((c) => !type || sameText(c.type, type)).map((c) => c.value)),
    [siblings, type]);
  const categoryOptions = useMemo(() => categories.map((c) => c.name), [categories]);

  const n = items.length;
  const keep = <Box component="span" sx={{ color: colors.textMuted, fontStyle: 'italic' }}>each keeps its own</Box>;
  const nothingChosen = !clean(category) && !clean(type) && !clean(value);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const payload = { componentIds: items.map((i) => i.id), type: clean(type) || null, value: clean(value) || null };
      if (existingCategory) payload.categoryId = existingCategory.id;
      else if (clean(category)) payload.newCategoryName = clean(category);
      const res = await relocateComponents(payload);
      const path = [clean(category), clean(type), clean(value)].filter(Boolean).join(' › ');
      onMoved(res.data?.length ?? n, path);
    } catch (err) {
      setError(err.response?.data?.message || 'Move failed.');
    } finally {
      setBusy(false);
    }
  };

  const field = (label, val, setVal, options, placeholder, helper) => (
    <Autocomplete
      freeSolo options={options} value={val} inputValue={val}
      onInputChange={(_, v) => setVal(v)}
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder={placeholder} helperText={helper}
          inputProps={{ ...params.inputProps, maxLength: 100 }} />
      )}
    />
  );

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FolderInput size={20} color={colors.primary} /> {title || (n === 1 ? 'Move component' : `Move ${n} components`)}
      </DialogTitle>
      <DialogContent>
        {n === 1 && (
          <Typography sx={{ fontSize: '0.875rem', mb: 2 }}>
            <b>{items[0].componentName}</b>
            <Box component="span" sx={{ color: colors.textSecondary }}>
              {' '}— now in {[items[0].category, items[0].type, items[0].value].filter(Boolean).join(' › ') || 'no folder'}
            </Box>
          </Typography>
        )}
        {n > 1 && (
          <Typography sx={{ fontSize: '0.875rem', mb: 2, color: colors.textSecondary }}>
            {n} components will move together. Leave a field empty to let each keep its own.
          </Typography>
        )}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box sx={{ display: 'grid', gap: 2, pt: 0.5 }}>
          {field('Category', category, setCategory, categoryOptions, 'e.g. Capacitor',
            clean(category) && !existingCategory ? `New category “${clean(category)}” will be created.` : ' ')}
          {field('Type', type, setType, typeOptions, n > 1 ? 'Leave empty to keep each one’s own' : 'e.g. SMD, THT, Ceramic', ' ')}
          {field('Value', value, setValue, valueOptions, n > 1 ? 'Leave empty to keep each one’s own' : 'e.g. 0.1uF, 4.7kΩ', ' ')}
        </Box>
        <Box sx={{ mt: 1, p: 1.5, borderRadius: 2, bgcolor: colors.primarySoft, display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <MapPin size={16} color={colors.primary} style={{ marginTop: 2, flexShrink: 0 }} />
          <Typography component="div" sx={{ fontSize: '0.8125rem' }}>
            New place: {clean(category) || keep} › {clean(type) || keep} › {clean(value) || keep}
            <Box sx={{ color: colors.textSecondary, mt: 0.25 }}>Stock, price, rack and history are not changed.</Box>
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={busy || nothingChosen}
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <FolderInput size={15} />}>
          Move{n > 1 ? ` ${n}` : ''}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MoveComponentsDialog;
