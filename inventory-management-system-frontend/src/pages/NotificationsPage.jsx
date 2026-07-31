import { useCallback, useEffect, useState } from 'react';
import {
  Box, Card, Button, Typography, Divider, ToggleButtonGroup, ToggleButton,
  Pagination, Snackbar, Alert, CircularProgress,
} from '@mui/material';
import {
  Bell, AlertTriangle, XCircle, CircuitBoard, Cpu, ShoppingCart, Boxes, Info, CheckCheck,
} from 'lucide-react';
import {
  getNotifications, markNotificationRead, markAllNotificationsRead,
} from '../api/notificationApi';
import { PageHeader } from '../components/ui';
import { colors } from '../theme/tokens';

const typeIcon = {
  LOW_STOCK: AlertTriangle, OUT_OF_STOCK: XCircle, COMPONENT_ADDED: CircuitBoard,
  EQUIPMENT_ADDED: Cpu, PURCHASE_CREATED: ShoppingCart, INVENTORY_UPDATED: Boxes, SYSTEM: Info,
};
const severityColor = { INFO: colors.info, SUCCESS: colors.success, WARNING: colors.warning, CRITICAL: colors.danger };
const severitySoft = { INFO: colors.infoSoft, SUCCESS: colors.successSoft, WARNING: colors.warningSoft, CRITICAL: colors.dangerSoft };

const formatWhen = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const SIZE = 12;

const NotificationsPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getNotifications({ unreadOnly, page, size: SIZE });
      setItems(res.data?.content || []);
      setTotalPages(res.data?.totalPages || 0);
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Failed to load notifications', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [unreadOnly, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRead = async (n) => {
    if (n.read) return;
    try {
      await markNotificationRead(n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    } catch { /* ignore */ }
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      setSnack({ open: true, message: 'All notifications marked as read', severity: 'success' });
      fetchData();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || 'Failed', severity: 'error' });
    }
  };

  return (
    <Box>
      <PageHeader
        title="Notifications"
        subtitle="System alerts, stock warnings and activity across your inventory."
        icon={Bell}
        breadcrumbs={[{ label: 'Overview' }, { label: 'Notifications' }]}
        actions={<Button variant="outlined" startIcon={<CheckCheck size={17} />} onClick={handleMarkAll}>Mark all read</Button>}
      />

      <Box sx={{ mb: 2.5 }}>
        <ToggleButtonGroup
          size="small" exclusive value={unreadOnly ? 'unread' : 'all'}
          onChange={(_, v) => { if (v !== null) { setUnreadOnly(v === 'unread'); setPage(0); } }}
        >
          <ToggleButton value="all" sx={{ textTransform: 'none', px: 2 }}>All</ToggleButton>
          <ToggleButton value="unread" sx={{ textTransform: 'none', px: 2 }}>Unread</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Card sx={{ overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : items.length === 0 ? (
          <Box sx={{ py: 9, textAlign: 'center' }}>
            <Box sx={{ width: 64, height: 64, borderRadius: '18px', display: 'grid', placeItems: 'center', bgcolor: colors.primarySoft, color: colors.primary, mx: 'auto', mb: 2.5 }}>
              <Bell size={30} strokeWidth={1.75} />
            </Box>
            <Typography sx={{ fontWeight: 600, mb: 0.5 }}>No notifications</Typography>
            <Typography color="text.secondary">{unreadOnly ? 'You have no unread notifications.' : 'Activity and alerts will appear here.'}</Typography>
          </Box>
        ) : (
          items.map((n, i) => {
            const Icon = typeIcon[n.type] || Info;
            const fg = severityColor[n.severity] || colors.info;
            const bg = severitySoft[n.severity] || colors.infoSoft;
            return (
              <Box key={n.id}>
                <Box
                  onClick={() => handleRead(n)}
                  sx={{
                    display: 'flex', gap: 2, px: 3, py: 2, cursor: n.read ? 'default' : 'pointer',
                    bgcolor: n.read ? 'transparent' : 'rgba(34,73,127,0.035)',
                    transition: 'background-color .15s ease', '&:hover': { bgcolor: colors.hover },
                  }}
                >
                  <Box sx={{ width: 42, height: 42, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: bg, color: fg, flexShrink: 0 }}>
                    <Icon size={20} />
                  </Box>
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontSize: '0.9375rem', fontWeight: n.read ? 500 : 700 }}>{n.title}</Typography>
                      {!n.read && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colors.accent }} />}
                    </Box>
                    <Typography sx={{ fontSize: '0.875rem', color: colors.textSecondary }}>{n.message}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted, mt: 0.5 }}>{formatWhen(n.createdAt)}</Typography>
                  </Box>
                </Box>
                {i < items.length - 1 && <Divider />}
              </Box>
            );
          })
        )}
      </Card>

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination count={totalPages} page={page + 1} onChange={(_, p) => setPage(p - 1)} color="primary" />
        </Box>
      )}

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack({ ...snack, open: false })}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default NotificationsPage;
