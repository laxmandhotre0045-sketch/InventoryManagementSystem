import { Box, Button, Divider, Drawer, IconButton, Typography } from '@mui/material';
import { Cpu, Pencil, Receipt, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SpecificationsEditor from '../common/SpecificationsEditor';
import { StatusBadge } from '../ui';
import { colors } from '../../theme/tokens';

const dateLabel = (v) =>
  (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const Fact = ({ label, children }) => (
  <Box sx={{ minWidth: 0 }}>
    <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {label}
    </Typography>
    <Typography component="div" sx={{ fontSize: '0.8125rem', fontWeight: 500, color: colors.textPrimary, wordBreak: 'break-word' }}>
      {children || '—'}
    </Typography>
  </Box>
);

const EquipmentDetailsDrawer = ({ equipment, open, onClose, canEdit, onEdit, statusOf }) => {
  const navigate = useNavigate();
  if (!equipment) return null;
  const e = equipment;
  const warrantyOver = e.warrantyExpiry && new Date(e.warrantyExpiry) < new Date(new Date().toDateString());

  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 520 }, bgcolor: colors.canvas } }}>
      <Box sx={{ p: 2.5, bgcolor: colors.paper, borderBottom: `1px solid ${colors.border}` }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
          <Box sx={{ p: 1, borderRadius: 2, bgcolor: colors.primarySoft, display: 'grid', placeItems: 'center' }}>
            <Cpu size={20} color={colors.primary} />
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', wordBreak: 'break-word' }}>{e.name}</Typography>
            <Typography sx={{ fontSize: '0.8rem', color: colors.textSecondary }}>
              {[e.itemCode, e.category].filter(Boolean).join(' · ')}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose}><X size={18} /></IconButton>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
          {canEdit && (
            <Button size="small" variant="outlined" startIcon={<Pencil size={14} />} onClick={() => onEdit(e)}>
              Edit details
            </Button>
          )}
          {canEdit && e.purchaseId && (
            <Button size="small" startIcon={<Receipt size={14} />} onClick={() => navigate('/purchases')}>
              Bought on purchase #{e.purchaseId}
            </Button>
          )}
        </Box>
      </Box>

      <Box sx={{ p: 2.5, display: 'grid', gap: 2 }}>
        <Box sx={{ p: 2, borderRadius: 2.5, border: `1px solid ${colors.border}`, bgcolor: colors.paper }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 1.75 }}>
            <Fact label="Status"><StatusBadge status={statusOf(e.status)} label={e.status || 'UNKNOWN'} /></Fact>
            <Fact label="Serial number">{e.serialNumber}</Fact>
            <Fact label="Manufacturer">{e.manufacturer}</Fact>
            <Fact label="Location">{e.location}</Fact>
            <Fact label="Purchase date">{e.purchaseDate && dateLabel(e.purchaseDate)}</Fact>
            <Fact label="Warranty until">
              {e.warrantyExpiry && (
                <Box component="span" sx={{ color: warrantyOver ? colors.danger : colors.textPrimary }}>
                  {dateLabel(e.warrantyExpiry)}{warrantyOver ? ' (expired)' : ''}
                </Box>
              )}
            </Fact>
          </Box>
          {e.notes && (
            <>
              <Divider sx={{ my: 1.5 }} />
              <Fact label="Notes"><Box component="span" sx={{ whiteSpace: 'pre-wrap' }}>{e.notes}</Box></Fact>
            </>
          )}
        </Box>

        <Box sx={{ p: 2, borderRadius: 2.5, border: `1px solid ${colors.border}`, bgcolor: colors.paper }}>
          <SpecificationsEditor itemType="equipment" itemId={e.id} canEdit={canEdit} />
        </Box>
      </Box>
    </Drawer>
  );
};

export default EquipmentDetailsDrawer;
