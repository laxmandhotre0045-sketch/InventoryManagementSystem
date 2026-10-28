import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Typography,
} from '@mui/material';
import { ArchiveRestore, Trash2 } from 'lucide-react';
import { getPurchaseBin, restorePurchase } from '../../api/purchaseApi';
import { formatCurrency } from '../../utils/currency';
import { colors } from '../../theme/tokens';

const dateLabel = (v) => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/** Purchases deleted in the last 7 days, each restorable exactly as it was. */
const PurchaseBinDialog = ({ open, onClose, onRestored }) => {
  const [entries, setEntries] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    getPurchaseBin().then((r) => setEntries(r.data || []))
      .catch((err) => { setEntries([]); setError(err.response?.data?.message || 'Could not load the bin.'); });
  }, []);

  useEffect(() => {
    if (open) { setEntries(null); setError(''); load(); }
  }, [open, load]);

  const restore = async (e) => {
    setBusyId(e.id);
    setError('');
    try {
      await restorePurchase(e.id);
      onRestored(`Invoice ${e.invoiceNumber} restored`
        + (e.componentsRemoved ? ` — ${e.unitsRemoved.toLocaleString()} units put back in stock` : ''));
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not restore this purchase.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onClose={busyId ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Trash2 size={20} color={colors.textSecondary} /> Bin
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: '0.8125rem', color: colors.textSecondary, mb: 1.5 }}>
          Deleted purchases stay here for 7 days. Restoring brings back the purchase, its lines and invoice
          file — and, if its components were removed, their stock and project-folder entries.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
        {entries === null ? (
          <Box sx={{ py: 3, display: 'grid', placeItems: 'center' }}><CircularProgress size={22} /></Box>
        ) : entries.length === 0 ? (
          <Alert severity="info">The bin is empty.</Alert>
        ) : entries.map((e) => (
          <Box key={e.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, borderTop: `1px solid ${colors.border}`, flexWrap: 'wrap' }}>
            <Box sx={{ flexGrow: 1, minWidth: 200 }}>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 700 }}>
                {e.invoiceNumber}
                <Box component="span" sx={{ fontWeight: 500, color: colors.textSecondary }}> · {e.supplierName}</Box>
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: colors.textSecondary }}>
                {formatCurrency(e.totalAmount)} · {e.itemCount} line{e.itemCount === 1 ? '' : 's'}
                {e.projectName ? ` · ${e.projectName}` : ''}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted }}>
                Deleted {dateLabel(e.deletedAt)}{e.deletedBy ? ` by ${e.deletedBy.split('@')[0]}` : ''}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                <Chip size="small" label={e.daysLeft <= 1 ? 'Last day' : `${e.daysLeft} days left`}
                  sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700,
                    bgcolor: e.daysLeft <= 1 ? colors.dangerSoft : colors.infoSoft, color: e.daysLeft <= 1 ? colors.danger : colors.info }} />
                {e.componentsRemoved && (
                  <Chip size="small" label={`Stock removed · ${e.unitsRemoved.toLocaleString()} units`}
                    sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, bgcolor: colors.warningSoft, color: colors.warning }} />
                )}
              </Box>
            </Box>
            <Button variant="outlined" size="small" onClick={() => restore(e)} disabled={!!busyId}
              startIcon={busyId === e.id ? <CircularProgress size={14} color="inherit" /> : <ArchiveRestore size={15} />}>
              Restore
            </Button>
          </Box>
        ))}
      </DialogContent>
      <DialogActions><Button onClick={onClose} disabled={!!busyId}>Close</Button></DialogActions>
    </Dialog>
  );
};

export default PurchaseBinDialog;
