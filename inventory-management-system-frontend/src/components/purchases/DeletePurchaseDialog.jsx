import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import { Trash2 } from 'lucide-react';
import { deletePurchase, getDeletePreview } from '../../api/purchaseApi';
import { formatCurrency } from '../../utils/currency';
import { colors } from '../../theme/tokens';

/**
 * Deleting a purchase moves it to the bin (restorable for 7 days). Optionally the stock
 * the invoice added is taken back out of the inventory — the preview shows exactly what
 * would change before anything does.
 */
const DeletePurchaseDialog = ({ open, purchase, onClose, onDeleted }) => {
  const [preview, setPreview] = useState(null);
  const [removeComponents, setRemoveComponents] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !purchase) return;
    setPreview(null); setRemoveComponents(false); setError('');
    getDeletePreview(purchase.id).then((r) => setPreview(r.data))
      .catch((err) => setError(err.response?.data?.message || 'Could not load this purchase.'));
  }, [open, purchase]);

  const lines = preview?.lines || [];
  const units = lines.reduce((s, l) => s + l.remove, 0);
  const shortfall = lines.some((l) => l.remove < l.invoiceQuantity);
  const archived = lines.filter((l) => l.archive).length;

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await deletePurchase(purchase.id, removeComponents);
      onDeleted(`Invoice ${purchase.invoiceNumber} moved to the bin`
        + (removeComponents ? ` — ${units.toLocaleString()} units taken out of stock` : '')
        + '. It can be restored for 7 days.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete this purchase.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Trash2 size={20} color={colors.danger} /> Delete purchase
      </DialogTitle>
      <DialogContent>
        {purchase && (
          <Typography sx={{ fontSize: '0.9rem', fontWeight: 600 }}>
            {purchase.invoiceNumber} · {purchase.supplierName}
            <Box component="span" sx={{ fontWeight: 500, color: colors.textSecondary }}> · {formatCurrency(purchase.totalAmount)}</Box>
          </Typography>
        )}
        <Alert severity="info" sx={{ mt: 1.5 }}>
          It goes to the <b>Bin</b> — you can restore it from there, exactly as it is now, for 7 days.
        </Alert>
        {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}

        {!preview && !error ? (
          <Box sx={{ py: 3, display: 'grid', placeItems: 'center' }}><CircularProgress size={22} /></Box>
        ) : preview && (
          <>
            <FormControlLabel
              sx={{ mt: 1.5, alignItems: 'flex-start' }}
              control={<Checkbox checked={removeComponents} onChange={(e) => setRemoveComponents(e.target.checked)}
                disabled={!lines.length} sx={{ pt: 0.5 }} />}
              label={(
                <Box>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                    Also remove this invoice’s components from the inventory
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: colors.textSecondary }}>
                    {lines.length
                      ? 'Takes the stock this invoice added back out. Leave it unticked to delete only the purchase record and keep the stock.'
                      : 'This purchase has no component lines.'}
                  </Typography>
                </Box>
              )}
            />
            {removeComponents && (
              <Box sx={{ mt: 1.5 }}>
                {shortfall && (
                  <Alert severity="warning" sx={{ mb: 1 }}>
                    Some of these units were already used, so only what is left in stock is taken out.
                  </Alert>
                )}
                <Box sx={{ maxHeight: 280, overflow: 'auto', border: `1px solid ${colors.border}`, borderRadius: 2 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Component</TableCell>
                        <TableCell align="right">In stock</TableCell>
                        <TableCell align="right">Remove</TableCell>
                        <TableCell align="right">After</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lines.map((l) => (
                        <TableRow key={l.componentId}>
                          <TableCell sx={{ fontSize: '0.78rem', wordBreak: 'break-word' }}>
                            {l.componentName}
                            {l.archive && (
                              <Chip size="small" label="Archived (restorable)"
                                sx={{ ml: 0.75, height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: colors.warningSoft, color: colors.warning }} />
                            )}
                          </TableCell>
                          <TableCell align="right">{l.inStock.toLocaleString()}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: colors.danger }}>
                            −{l.remove.toLocaleString()}
                          </TableCell>
                          <TableCell align="right">{l.stockAfter.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
                <Typography sx={{ fontSize: '0.78rem', color: colors.textSecondary, mt: 1 }}>
                  {units.toLocaleString()} units taken out of stock
                  {archived ? ` · ${archived} component${archived === 1 ? '' : 's'} that only this invoice added will be archived` : ''}
                  {preview.folderEntries ? ` · ${preview.folderEntries} project-folder entr${preview.folderEntries === 1 ? 'y' : 'ies'}${preview.projectName ? ` (${preview.projectName})` : ''} removed` : ''}
                  . Restoring from the bin puts all of it back.
                </Typography>
              </Box>
            )}
            {preview.equipmentCount > 0 && (
              <Typography sx={{ fontSize: '0.78rem', color: colors.textMuted, mt: 1.5 }}>
                {preview.equipmentCount} equipment item{preview.equipmentCount === 1 ? '' : 's'} registered from this invoice
                stay{preview.equipmentCount === 1 ? 's' : ''} in Equipment.
              </Typography>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button color="error" variant="contained" onClick={confirm} disabled={!preview || busy}
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <Trash2 size={15} />}>
          {removeComponents ? 'Move to bin and remove stock' : 'Move to bin'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeletePurchaseDialog;
