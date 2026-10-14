import { Autocomplete, Box, Grid, MenuItem, TextField, Tooltip, Typography } from '@mui/material';
import { MapPin, Info } from 'lucide-react';
import { colors } from '../../theme/tokens';

const SEP = ' › ';
const TYPE_OPTIONS = ['SMD', 'THT', 'Module'];

/** "Capacitor › SMD › 100nF" from the parts that are present. */
const pathOf = (...parts) => parts.filter((p) => p && String(p).trim()).map((p) => String(p).trim()).join(SEP);

const PathChip = ({ label, path, muted }) => (
  <Box sx={{
    display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.75, borderRadius: 2,
    bgcolor: muted ? colors.canvas : colors.primarySoft, border: `1px solid ${muted ? colors.border : 'transparent'}`,
  }}>
    <MapPin size={14} color={muted ? colors.textMuted : colors.primary} style={{ flexShrink: 0 }} />
    <Typography sx={{ fontSize: '0.75rem', color: colors.textSecondary, whiteSpace: 'nowrap' }}>{label}</Typography>
    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: muted ? colors.textSecondary : colors.primary, wordBreak: 'break-word' }}>
      {path || '—'}
    </Typography>
  </Box>
);

/**
 * Shows where an invoice line will end up in the inventory and, for new items, lets the
 * user correct the auto-suggested Category › Type › Value before confirming.
 */
const InventoryPathEditor = ({ line, categories, components, equipment, onChange }) => {
  const l = line;

  if (l.resolution === 'EXISTING_COMPONENT') {
    const c = components.find((x) => String(x.id) === String(l.componentId));
    if (!c) return null;
    const p = pathOf(c.category, c.type, c.value);
    return (
      <Box sx={{ mt: 1.25 }}>
        <PathChip label="Stock goes to" muted
          path={`${p || 'Uncategorised'}${c.rackNo ? ` · Rack ${c.rackNo}` : ''}${c.location ? ` · ${c.location}` : ''}`} />
        {!c.type && !c.value && (
          <Typography sx={{ fontSize: '0.72rem', color: colors.textMuted, mt: 0.5 }}>
            This component has no Type / Value yet — set them on the Components page to file it precisely.
          </Typography>
        )}
      </Box>
    );
  }

  if (l.resolution === 'EXISTING_EQUIPMENT') {
    const e = equipment.find((x) => String(x.id) === String(l.equipmentId));
    if (!e) return null;
    return (
      <Box sx={{ mt: 1.25 }}>
        <PathChip label="Equipment" muted path={pathOf('Equipment', e.category, e.name)} />
      </Box>
    );
  }

  if (l.resolution === 'NEW_EQUIPMENT') {
    return (
      <Box sx={{ mt: 1.25, display: 'grid', gap: 1 }}>
        <PathChip label="Will be registered as" path={pathOf('Equipment', l.invCategory || 'Uncategorised')} />
        <TextField size="small" label="Equipment category" value={l.invCategory || ''}
          onChange={(e) => onChange({ invCategory: e.target.value })} sx={{ maxWidth: 320 }} />
      </Box>
    );
  }

  if (l.resolution !== 'NEW_COMPONENT') return null;

  const names = categories.map((c) => c.name);
  const isNewCategory = l.invCategory && !names.some((n) => n.toLowerCase() === l.invCategory.toLowerCase());

  return (
    <Box sx={{ mt: 1.25, display: 'grid', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <PathChip label="Will be filed under" path={pathOf(l.invCategory, l.invType, l.invValue)} />
        {l.invReason && (
          <Tooltip title={l.invReason}>
            <Box sx={{ display: 'inline-flex', color: colors.textMuted, cursor: 'help' }}><Info size={15} /></Box>
          </Tooltip>
        )}
        {isNewCategory && (
          <Typography sx={{ fontSize: '0.72rem', color: colors.warning, fontWeight: 600 }}>
            new category — will be created
          </Typography>
        )}
      </Box>
      <Grid container spacing={1}>
        <Grid item xs={12} sm={5}>
          <TextField select fullWidth size="small" label="Category" value={l.invCategory || ''}
            onChange={(e) => onChange({ invCategory: e.target.value })}>
            {isNewCategory && <MenuItem value={l.invCategory}>➕ New: {l.invCategory}</MenuItem>}
            {names.map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Autocomplete freeSolo size="small" options={TYPE_OPTIONS} value={l.invType || ''}
            onInputChange={(_, v) => onChange({ invType: v })}
            renderInput={(params) => <TextField {...params} label="Type" placeholder="SMD / THT" />} />
        </Grid>
        <Grid item xs={6} sm={4}>
          <TextField fullWidth size="small" label="Value" value={l.invValue || ''} placeholder="e.g. 100nF"
            onChange={(e) => onChange({ invValue: e.target.value })} />
        </Grid>
      </Grid>
    </Box>
  );
};

export default InventoryPathEditor;
