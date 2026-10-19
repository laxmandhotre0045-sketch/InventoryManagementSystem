import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, Drawer, IconButton, TextField, Tooltip, Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ArrowRightLeft, CircuitBoard, FolderInput, FolderOpen, History, MapPin, Pencil, X } from 'lucide-react';
import { moveComponentToEquipment } from '../../api/componentApi';
import { getComponentHistory } from '../../api/inventoryApi';
import SpecificationsEditor from '../common/SpecificationsEditor';
import { StatusBadge } from '../ui';
import { formatCurrency } from '../../utils/currency';
import { colors } from '../../theme/tokens';

const dateLabel = (v) =>
  (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const Fact = ({ label, children }) => (
  <Box sx={{ minWidth: 0 }}>
    <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {label}
    </Typography>
    <Typography component="div" sx={{ fontSize: '0.8125rem', fontWeight: 500, color: colors.textPrimary, wordBreak: 'break-word' }}>
      {children ?? '—'}
    </Typography>
  </Box>
);

const isModuleCategory = (c) => /module/i.test(c?.category || '');

/**
 * Preview-then-confirm dialog that turns a component into equipment records (one per
 * unit). The component itself is archived, never deleted, so it can be restored.
 */
const MoveToEquipmentDialog = ({ component, open, onClose, onMoved }) => {
  const [plan, setPlan] = useState(null);
  const [form, setForm] = useState({ name: '', equipmentCategory: '', manufacturer: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !component) return;
    let cancelled = false;
    setPlan(null);
    setError('');
    setBusy(true);
    moveComponentToEquipment(component.id, {}, true)
      .then((res) => {
        if (cancelled) return;
        const p = res.data;
        setPlan(p);
        setForm({ name: p.equipmentName || '', equipmentCategory: p.equipmentCategory || '', manufacturer: p.manufacturer || '' });
      })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.message || 'Could not prepare the move.'); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [open, component]);

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await moveComponentToEquipment(component.id, form, false);
      onMoved(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Move failed.');
    } finally {
      setBusy(false);
    }
  };

  const codes = plan?.equipmentCodes || [];
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Move to Equipment</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
        {!plan && busy && <Box sx={{ py: 3, display: 'grid', placeItems: 'center' }}><CircularProgress size={24} /></Box>}
        {plan && (
          <>
            <Typography sx={{ fontSize: '0.875rem', mb: 1.5 }}>
              This creates <b>{plan.units}</b> equipment record{plan.units === 1 ? '' : 's'} ({codes[0]}
              {codes.length > 1 ? ` – ${codes[codes.length - 1]}` : ''}), one per unit, each with its own serial
              number field. The component <b>{plan.componentItemCode}</b> is archived — not deleted — and can be
              restored from Components.
            </Typography>
            <Box sx={{ display: 'grid', gap: 1.5 }}>
              <TextField size="small" label="Equipment name" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                <TextField size="small" label="Equipment category" value={form.equipmentCategory}
                  onChange={(e) => setForm({ ...form, equipmentCategory: e.target.value })} />
                <TextField size="small" label="Manufacturer" value={form.manufacturer}
                  onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
              </Box>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mt: 2 }}>
              <Fact label="Location">{plan.location}</Fact>
              <Fact label="Status">{plan.status}</Fact>
            </Box>
            {plan.specifications?.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.5 }}>
                  Specifications carried over
                </Typography>
                {plan.specifications.map((s) => (
                  <Typography key={s.key} sx={{ fontSize: '0.8125rem' }}>
                    <Box component="span" sx={{ color: colors.textSecondary }}>{s.key}:</Box> {s.value}
                  </Typography>
                ))}
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={confirm} disabled={busy || !plan || !form.name.trim()}
          startIcon={busy && plan ? <CircularProgress size={14} color="inherit" /> : <ArrowRightLeft size={15} />}>
          Move {plan?.units ?? ''} unit{plan?.units === 1 ? '' : 's'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const ComponentDetailsDrawer = ({ component, open, onClose, canEdit, onEdit, onRelocate, onMoved }) => {
  const navigate = useNavigate();
  const [history, setHistory] = useState({ rows: [], state: 'idle' });
  const [moveOpen, setMoveOpen] = useState(false);
  const id = component?.id;

  useEffect(() => {
    if (!open || !id) return;
    let cancelled = false;
    setHistory({ rows: [], state: 'loading' });
    getComponentHistory(id, { page: 0, size: 5 })
      .then((res) => { if (!cancelled) setHistory({ rows: res.data?.content || [], state: 'ok' }); })
      // Stock history is admin-only; for other roles the section simply says so.
      .catch((err) => { if (!cancelled) setHistory({ rows: [], state: err.response?.status === 403 ? 'forbidden' : 'error' }); });
    return () => { cancelled = true; };
  }, [open, id]);

  if (!component) return null;
  const c = component;
  const path = [c.category, c.type, c.value].filter(Boolean).join(' › ');
  const archived = c.status === 'ARCHIVED';

  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 520 }, bgcolor: colors.canvas } }}>
      <Box sx={{ p: 2.5, bgcolor: colors.paper, borderBottom: `1px solid ${colors.border}` }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
          <Box sx={{ p: 1, borderRadius: 2, bgcolor: colors.primarySoft, display: 'grid', placeItems: 'center' }}>
            <CircuitBoard size={20} color={colors.primary} />
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', wordBreak: 'break-word' }}>{c.componentName}</Typography>
            <Typography sx={{ fontSize: '0.8rem', color: colors.textSecondary }}>{c.itemCode}</Typography>
          </Box>
          <IconButton size="small" onClick={onClose}><X size={18} /></IconButton>
        </Box>
        {path && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.25, color: colors.textSecondary }}>
            <MapPin size={14} />
            <Typography sx={{ fontSize: '0.8125rem' }}>{path}</Typography>
          </Box>
        )}
        {canEdit && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
            <Button size="small" variant="outlined" startIcon={<Pencil size={14} />} onClick={() => onEdit(c)}>
              Edit details
            </Button>
            {onRelocate && (
              <Button size="small" variant="outlined" startIcon={<FolderInput size={14} />} onClick={() => onRelocate(c)}>
                Change folder
              </Button>
            )}
            {!archived && (
              <Tooltip title="For modules and boards that are really equipment — creates one equipment record per unit">
                <Button size="small" variant={isModuleCategory(c) ? 'contained' : 'text'} startIcon={<ArrowRightLeft size={14} />}
                  onClick={() => setMoveOpen(true)}>
                  Move to Equipment
                </Button>
              </Tooltip>
            )}
          </Box>
        )}
      </Box>

      <Box sx={{ p: 2.5, display: 'grid', gap: 2 }}>
        <Box sx={{ p: 2, borderRadius: 2.5, border: `1px solid ${colors.border}`, bgcolor: colors.paper }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 1.75 }}>
            <Fact label="Status">
              {archived ? <StatusBadge status="cancelled" label="Archived" />
                : <StatusBadge status={c.quantity > 0 && c.status === 'ACTIVE' ? 'available' : 'not_available'} />}
            </Fact>
            <Fact label="In stock">{c.quantity?.toLocaleString()} {c.unit || ''}</Fact>
            <Fact label="Minimum">{c.minimumQuantity?.toLocaleString()}</Fact>
            <Fact label="Unit price">{c.unitPrice != null ? formatCurrency(c.unitPrice) : 'Not set'}</Fact>
            <Fact label="Stock value">{c.stockValue != null ? formatCurrency(c.stockValue) : '—'}</Fact>
            <Fact label="Rack / location">{[c.rackNo && `Rack ${c.rackNo}`, c.location].filter(Boolean).join(' · ') || '—'}</Fact>
            <Fact label="Added">{dateLabel(c.createdAt)}</Fact>
            <Fact label="Updated">{dateLabel(c.updatedAt)}</Fact>
          </Box>
          {c.description && (
            <>
              <Divider sx={{ my: 1.5 }} />
              <Fact label="Description">
                <Box component="span" sx={{ whiteSpace: 'pre-wrap' }}>{c.description}</Box>
              </Fact>
            </>
          )}
        </Box>

        <Box sx={{ p: 2, borderRadius: 2.5, border: `1px solid ${colors.border}`, bgcolor: colors.paper }}>
          <SpecificationsEditor itemType="components" itemId={c.id} canEdit={canEdit} />
        </Box>

        {c.projects?.length > 0 && (
          <Box sx={{ p: 2, borderRadius: 2.5, border: `1px solid ${colors.border}`, bgcolor: colors.paper }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <FolderOpen size={17} color={colors.accent} />
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700 }}>In project folders</Typography>
            </Box>
            {c.projects.map((p) => (
              <Box key={p.projectId} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, borderTop: `1px solid ${colors.border}` }}>
                <Box component="button" type="button" onClick={() => navigate(`/projects/${p.projectId}`)}
                  sx={{ all: 'unset', cursor: 'pointer', flexGrow: 1, fontWeight: 600, color: colors.primary, '&:hover': { textDecoration: 'underline' } }}>
                  {p.projectName}
                </Box>
                <Typography sx={{ fontSize: '0.8125rem', color: colors.textSecondary }}>
                  {p.allocated} in folder · {p.remaining} not used
                </Typography>
              </Box>
            ))}
            <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted, mt: 0.5 }}>
              {c.reservedForProjects} of the {c.quantity} in stock belong to projects · {Math.max((c.quantity || 0) - (c.reservedForProjects || 0), 0)} free
            </Typography>
          </Box>
        )}

        <Box sx={{ p: 2, borderRadius: 2.5, border: `1px solid ${colors.border}`, bgcolor: colors.paper }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <History size={17} color={colors.primary} />
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700 }}>Recent stock movements</Typography>
          </Box>
          {history.state === 'loading' && <CircularProgress size={20} />}
          {history.state === 'forbidden' && (
            <Typography sx={{ fontSize: '0.8125rem', color: colors.textMuted }}>Stock history is visible to admins.</Typography>
          )}
          {history.state === 'error' && (
            <Typography sx={{ fontSize: '0.8125rem', color: colors.textMuted }}>Could not load stock history.</Typography>
          )}
          {history.state === 'ok' && history.rows.length === 0 && (
            <Typography sx={{ fontSize: '0.8125rem', color: colors.textMuted }}>No stock movements yet.</Typography>
          )}
          {history.rows.map((t) => {
            const isIn = String(t.transactionType).includes('IN');
            return (
              <Box key={t.id} sx={{ display: 'flex', gap: 1.5, py: 0.75, borderTop: `1px solid ${colors.border}` }}>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, minWidth: 64, color: isIn ? colors.success : colors.danger }}>
                  {isIn ? '+' : '−'}{t.quantity}
                </Typography>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.8125rem', wordBreak: 'break-word' }}>{t.remarks || t.transactionType}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted }}>
                    {dateLabel(t.transactionDate || t.createdAt)}{t.createdBy ? ` · ${t.createdBy}` : ''}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>

      <MoveToEquipmentDialog component={c} open={moveOpen} onClose={() => setMoveOpen(false)}
        onMoved={(result) => { setMoveOpen(false); onMoved?.(result); }} />
    </Drawer>
  );
};

export default ComponentDetailsDrawer;
