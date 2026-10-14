import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, CircularProgress, IconButton, Link, TextField, Tooltip, Typography,
} from '@mui/material';
import { ArrowDown, ArrowUp, ListPlus, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { getSpecifications, saveSpecifications } from '../../api/specApi';
import { colors } from '../../theme/tokens';

// Common specification names offered while typing; any other name can be typed freely.
const SUGGESTED_KEYS = [
  'Manufacturer', 'Manufacturer part number', 'Supplier part code', 'Package', 'Mounting',
  'Voltage rating', 'Current rating', 'Power rating', 'Tolerance', 'Input voltage', 'Output voltage',
  'Frequency', 'Interface', 'Operating temperature', 'Dimensions', 'Datasheet', 'HSN code',
  'Warranty', 'Notes',
];

const isUrl = (s) => /^https?:\/\/\S+$/i.test(String(s || '').trim());

/**
 * View and edit the name/value specifications of a component or piece of equipment.
 * Saving replaces the whole list, so adding, editing, removing and reordering rows all
 * go through one Save.
 *
 * itemType: 'components' | 'equipment'
 */
const SpecificationsEditor = ({ itemType, itemId, canEdit }) => {
  const [specs, setSpecs] = useState([]);
  const [draft, setDraft] = useState([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!itemId) return;
    setLoading(true);
    setError('');
    try {
      const res = await getSpecifications(itemType, itemId);
      setSpecs(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load specifications.');
    } finally {
      setLoading(false);
    }
  }, [itemType, itemId]);

  useEffect(() => { setEditing(false); load(); }, [load]);

  const startEdit = () => {
    setDraft(specs.length ? specs.map((s) => ({ ...s })) : [{ key: '', value: '' }]);
    setEditing(true);
    setError('');
  };

  const setRow = (i, patch) => setDraft((d) => d.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRow = (i) => setDraft((d) => d.filter((_, idx) => idx !== i));
  const moveRow = (i, dir) => setDraft((d) => {
    const j = i + dir;
    if (j < 0 || j >= d.length) return d;
    const next = [...d];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const entries = draft
        .map((r) => ({ key: (r.key || '').trim(), value: (r.value || '').trim() }))
        .filter((r) => r.key);
      const res = await saveSpecifications(itemType, itemId, entries);
      setSpecs(res.data || []);
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save specifications.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <ListPlus size={17} color={colors.primary} />
        <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, flexGrow: 1 }}>Specifications</Typography>
        {canEdit && !editing && (
          <Button size="small" startIcon={<Pencil size={14} />} onClick={startEdit}>
            {specs.length ? 'Edit' : 'Add'}
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <Box sx={{ py: 2, display: 'grid', placeItems: 'center' }}><CircularProgress size={22} /></Box>
      ) : !editing ? (
        specs.length === 0 ? (
          <Typography sx={{ fontSize: '0.8125rem', color: colors.textMuted }}>
            No specifications yet.{canEdit ? ' Use “Add” to record package, ratings, datasheet link and so on.' : ''}
          </Typography>
        ) : (
          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 2, overflow: 'hidden' }}>
            {specs.map((s, i) => (
              <Box key={`${s.key}-${i}`} sx={{
                display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '38% 62%' }, gap: { xs: 0.25, sm: 1.5 },
                px: 1.5, py: 1, bgcolor: i % 2 ? colors.canvas : colors.paper,
                borderTop: i ? `1px solid ${colors.border}` : 'none',
              }}>
                <Typography sx={{ fontSize: '0.8rem', color: colors.textSecondary, fontWeight: 600, wordBreak: 'break-word' }}>
                  {s.key}
                </Typography>
                <Typography component="div" sx={{ fontSize: '0.8125rem', color: colors.textPrimary, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                  {isUrl(s.value)
                    ? <Link href={s.value.trim()} target="_blank" rel="noopener noreferrer">{s.value.trim()}</Link>
                    : (s.value || '—')}
                </Typography>
              </Box>
            ))}
          </Box>
        )
      ) : (
        <Box sx={{ display: 'grid', gap: 1 }}>
          {draft.map((r, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start', flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
              <Autocomplete freeSolo size="small" options={SUGGESTED_KEYS} value={r.key}
                onInputChange={(_, v) => setRow(i, { key: v })}
                sx={{ flex: { xs: '1 1 100%', sm: '0 0 38%' } }}
                renderInput={(params) => <TextField {...params} placeholder="Name, e.g. Package" />} />
              <TextField size="small" placeholder="Value, e.g. SOIC-8" value={r.value}
                onChange={(e) => setRow(i, { value: e.target.value })} multiline maxRows={4}
                sx={{ flex: '1 1 auto', minWidth: 0 }} />
              <Box sx={{ display: 'flex', flexShrink: 0 }}>
                <Tooltip title="Move up"><span><IconButton size="small" disabled={i === 0} onClick={() => moveRow(i, -1)}><ArrowUp size={15} /></IconButton></span></Tooltip>
                <Tooltip title="Move down"><span><IconButton size="small" disabled={i === draft.length - 1} onClick={() => moveRow(i, 1)}><ArrowDown size={15} /></IconButton></span></Tooltip>
                <Tooltip title="Remove"><IconButton size="small" sx={{ color: colors.danger }} onClick={() => removeRow(i)}><Trash2 size={15} /></IconButton></Tooltip>
              </Box>
            </Box>
          ))}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
            <Button size="small" startIcon={<Plus size={15} />} onClick={() => setDraft((d) => [...d, { key: '', value: '' }])}>
              Add row
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button size="small" startIcon={<X size={15} />} onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
            <Button size="small" variant="contained" startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save size={15} />}
              onClick={save} disabled={saving}>
              Save
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default SpecificationsEditor;
