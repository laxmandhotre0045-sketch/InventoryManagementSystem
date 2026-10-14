import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Drawer, Box, Typography, IconButton, Divider, LinearProgress, Chip, Button, Tooltip,
} from '@mui/material';
import {
  X, ClipboardList, CircuitBoard, Wrench, Eye, Download, MapPin, ExternalLink, FileText,
} from 'lucide-react';
import { getPurchaseDetails } from '../../api/purchaseApi';
import { StatusBadge, EmptyState } from '../ui';
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

const SectionTitle = ({ icon: Icon, children }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, mb: 1.25 }}>
    <Icon size={17} color={colors.primary} />
    <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700 }}>{children}</Typography>
  </Box>
);

const cardSx = {
  p: 1.75, mb: 1.25, borderRadius: 2.5, border: `1px solid ${colors.border}`, bgcolor: colors.paper,
};

/** Category › Type › Value, skipping whatever is missing. */
const specPath = (c) => [c.category, c.type, c.value].filter(Boolean).join(' › ');

const ComponentCard = ({ c, onOpen }) => {
  const low = c.currentStock != null && c.minimumQuantity != null && c.currentStock <= c.minimumQuantity;
  const priceChanged = c.currentUnitPrice != null && c.unitPricePaid != null
    && Number(c.currentUnitPrice) !== Number(c.unitPricePaid);
  return (
    <Box sx={cardSx}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', wordBreak: 'break-word' }}>
            {c.componentName || 'Component removed'}
          </Typography>
          {specPath(c) && (
            <Typography sx={{ fontSize: '0.8rem', color: colors.textSecondary, mt: 0.25 }}>{specPath(c)}</Typography>
          )}
        </Box>
        {c.componentId && (
          <Tooltip title="Open in Components">
            <IconButton size="small" onClick={() => onOpen(c.componentName)}><ExternalLink size={15} /></IconButton>
          </Tooltip>
        )}
      </Box>

      <Box sx={{ mt: 1, p: 1.25, borderRadius: 2, bgcolor: colors.canvas }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.25 }}>
          Specifications
        </Typography>
        <Typography sx={{ fontSize: '0.8125rem', color: c.description ? colors.textPrimary : colors.textMuted, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {c.description || 'No specifications recorded for this component yet. Add them from the Components page.'}
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5, mt: 1.5 }}>
        <Fact label="Bought">
          {c.quantityPurchased} {c.unit || 'pcs'} × {formatCurrency(c.unitPricePaid)}
        </Fact>
        <Fact label="Line total">{formatCurrency(c.lineTotal)}</Fact>
        <Fact label="In stock now">
          <Box component="span" sx={{ color: low ? colors.warning : colors.textPrimary, fontWeight: 600 }}>
            {c.currentStock ?? '—'}
          </Box>
          {low && <Box component="span" sx={{ color: colors.warning, fontSize: '0.72rem' }}> · low</Box>}
        </Fact>
        <Fact label="Rack / Location">
          {[c.rackNo && `Rack ${c.rackNo}`, c.location].filter(Boolean).join(' · ') || '—'}
        </Fact>
        <Fact label="Status">
          {c.status === 'ACTIVE' ? <StatusBadge status="available" label="Available" />
            : c.status ? <StatusBadge status="cancelled" label={c.status === 'ARCHIVED' ? 'Archived' : 'Not Available'} /> : '—'}
        </Fact>
        {priceChanged && (
          <Fact label="Current unit price">{formatCurrency(c.currentUnitPrice)}</Fact>
        )}
      </Box>
    </Box>
  );
};

const EquipmentCard = ({ e }) => (
  <Box sx={cardSx}>
    <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', wordBreak: 'break-word' }}>{e.name}</Typography>
    {(e.category || e.manufacturer) && (
      <Typography sx={{ fontSize: '0.8rem', color: colors.textSecondary, mt: 0.25 }}>
        {[e.category, e.manufacturer].filter(Boolean).join(' · ')}
      </Typography>
    )}
    {e.notes && (
      <Box sx={{ mt: 1, p: 1.25, borderRadius: 2, bgcolor: colors.canvas }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.25 }}>
          Notes / specifications
        </Typography>
        <Typography sx={{ fontSize: '0.8125rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{e.notes}</Typography>
      </Box>
    )}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5, mt: 1.5 }}>
      <Fact label="Serial no.">{e.serialNumber || '—'}</Fact>
      <Fact label="Status">{e.status ? <StatusBadge status={e.status} /> : '—'}</Fact>
      <Fact label="Location">{e.location || '—'}</Fact>
      <Fact label="Purchased">{dateLabel(e.purchaseDate)}</Fact>
      <Fact label="Warranty until">{dateLabel(e.warrantyExpiry)}</Fact>
    </Box>
  </Box>
);

/**
 * Everything a purchase brought in: each component with its specification, price paid
 * and current stock, plus any equipment registered from the invoice.
 */
const PurchaseDetailsDrawer = ({ open, purchase, onClose, onViewInvoice, onDownloadInvoice }) => {
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !purchase?.id) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setDetail(null);
    getPurchaseDetails(purchase.id)
      .then((res) => { if (!cancelled) setDetail(res.data); })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.message || 'Could not load this purchase.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, purchase?.id]);

  const p = detail?.purchase || purchase || {};
  const components = detail?.components || [];
  const equipment = detail?.equipment || [];

  const openComponent = (name) => {
    onClose?.();
    navigate(`/components?q=${encodeURIComponent(name)}`);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 520, md: 620 }, maxWidth: '100%' } } }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ClipboardList size={20} color={colors.primary} />
            <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', flexGrow: 1, minWidth: 0 }} noWrap>
              Purchase {p.invoiceNumber ? `· ${p.invoiceNumber}` : ''}
            </Typography>
            <IconButton onClick={onClose}><X size={20} /></IconButton>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5, mt: 1.5 }}>
            <Fact label="Supplier">{p.supplierName}</Fact>
            <Fact label="Invoice date">{dateLabel(p.purchaseDate)}</Fact>
            <Fact label="Total">
              <Box component="span" sx={{ fontWeight: 700 }}>{formatCurrency(p.totalAmount)}</Box>
            </Fact>
          </Box>
          {p.remarks && (
            <Typography sx={{ fontSize: '0.8rem', color: colors.textSecondary, mt: 1.25 }}>{p.remarks}</Typography>
          )}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
            {p.hasInvoice ? (
              <>
                <Button size="small" variant="outlined" startIcon={<Eye size={15} />} onClick={() => onViewInvoice?.(purchase)}>
                  View invoice
                </Button>
                <Button size="small" variant="text" startIcon={<Download size={15} />} onClick={() => onDownloadInvoice?.(purchase)}>
                  Download
                </Button>
              </>
            ) : (
              <Chip size="small" icon={<FileText size={13} />} label="No invoice attached"
                sx={{ bgcolor: colors.warningSoft, color: colors.warning, fontWeight: 600 }} />
            )}
          </Box>
        </Box>
        <Divider />
        {loading && <LinearProgress />}

        {/* Body */}
        <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 2.5, py: 2, bgcolor: colors.canvas }}>
          {error ? (
            <EmptyState icon={ClipboardList} title="Could not load purchase" description={error} dense />
          ) : !detail && loading ? null : (
            <>
              <SectionTitle icon={CircuitBoard}>Components ({components.length})</SectionTitle>
              {components.length === 0 ? (
                <Typography sx={{ fontSize: '0.8125rem', color: colors.textMuted, mb: 2 }}>
                  No components were recorded on this purchase.
                </Typography>
              ) : components.map((c) => (
                <ComponentCard key={c.purchaseItemId} c={c} onOpen={openComponent} />
              ))}

              <SectionTitle icon={Wrench}>Equipment ({equipment.length})</SectionTitle>
              {equipment.length === 0 ? (
                <Typography sx={{ fontSize: '0.8125rem', color: colors.textMuted, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <MapPin size={14} /> No equipment was registered from this purchase.
                </Typography>
              ) : equipment.map((e) => <EquipmentCard key={e.equipmentId} e={e} />)}
            </>
          )}
        </Box>
      </Box>
    </Drawer>
  );
};

export default PurchaseDetailsDrawer;
