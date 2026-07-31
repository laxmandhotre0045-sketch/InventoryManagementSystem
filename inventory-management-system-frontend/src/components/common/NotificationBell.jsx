import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconButton, Badge, Menu, Box, Typography, Divider, Button, Tooltip, CircularProgress,
} from '@mui/material';
import {
  Bell, AlertTriangle, XCircle, CircuitBoard, Cpu, ShoppingCart, Boxes, Info, CheckCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  getUnreadCount, getRecentNotifications, markNotificationRead, markAllNotificationsRead,
} from '../../api/notificationApi';
import { colors } from '../../theme/tokens';

const POLL_MS = 45000;

const typeIcon = {
  LOW_STOCK: AlertTriangle,
  OUT_OF_STOCK: XCircle,
  COMPONENT_ADDED: CircuitBoard,
  EQUIPMENT_ADDED: Cpu,
  PURCHASE_CREATED: ShoppingCart,
  INVENTORY_UPDATED: Boxes,
  SYSTEM: Info,
};

const severityColor = {
  INFO: colors.info,
  SUCCESS: colors.success,
  WARNING: colors.warning,
  CRITICAL: colors.danger,
};
const severitySoft = {
  INFO: colors.infoSoft,
  SUCCESS: colors.successSoft,
  WARNING: colors.warningSoft,
  CRITICAL: colors.dangerSoft,
};

const timeAgo = (value) => {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const NotificationBell = () => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);

  const refreshCount = useCallback(async () => {
    try {
      const res = await getUnreadCount();
      setCount(res.data ?? 0);
    } catch { /* silent — bell must never break the app */ }
  }, []);

  useEffect(() => {
    refreshCount();
    timer.current = setInterval(refreshCount, POLL_MS);
    return () => clearInterval(timer.current);
  }, [refreshCount]);

  const openMenu = async (e) => {
    setAnchorEl(e.currentTarget);
    setLoading(true);
    try {
      const res = await getRecentNotifications();
      setItems(res.data || []);
    } catch { setItems([]); } finally { setLoading(false); }
  };

  const handleItemClick = async (n) => {
    if (!n.read) {
      try {
        await markNotificationRead(n.id);
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
        setCount((c) => Math.max(0, c - 1));
      } catch { /* ignore */ }
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((x) => ({ ...x, read: true })));
      setCount(0);
    } catch { /* ignore */ }
  };

  const viewAll = () => { setAnchorEl(null); navigate('/notifications'); };

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton onClick={openMenu} sx={{ color: colors.textSecondary }}>
          <Badge
            badgeContent={count}
            max={99}
            invisible={count === 0}
            sx={{ '& .MuiBadge-badge': { bgcolor: colors.accent, color: '#fff', fontSize: '0.6875rem', fontWeight: 700, minWidth: 18, height: 18, boxShadow: '0 0 0 2px #fff' } }}
          >
            <Bell size={21} />
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 380, maxWidth: '92vw', maxHeight: 520, mt: 0.5, overflow: 'hidden' } } }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700 }}>Notifications</Typography>
          {count > 0 && (
            <Button size="small" startIcon={<CheckCheck size={15} />} onClick={handleMarkAll} sx={{ textTransform: 'none' }}>
              Mark all read
            </Button>
          )}
        </Box>
        <Divider />

        <Box sx={{ maxHeight: 360, overflowY: 'auto' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={22} /></Box>
          ) : items.length === 0 ? (
            <Box sx={{ py: 5, textAlign: 'center', px: 3 }}>
              <Bell size={26} color={colors.textMuted} />
              <Typography sx={{ color: colors.textMuted, mt: 1 }}>You're all caught up</Typography>
            </Box>
          ) : (
            items.map((n) => {
              const Icon = typeIcon[n.type] || Info;
              const fg = severityColor[n.severity] || colors.info;
              const bg = severitySoft[n.severity] || colors.infoSoft;
              return (
                <Box
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  sx={{
                    display: 'flex', gap: 1.5, px: 2, py: 1.5, cursor: 'pointer',
                    bgcolor: n.read ? 'transparent' : 'rgba(34,73,127,0.035)',
                    borderBottom: `1px solid ${colors.border}`,
                    transition: 'background-color .15s ease',
                    '&:hover': { bgcolor: colors.hover },
                  }}
                >
                  <Box sx={{ width: 36, height: 36, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: bg, color: fg, flexShrink: 0 }}>
                    <Icon size={18} />
                  </Box>
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: n.read ? 500 : 700 }}>{n.title}</Typography>
                    <Typography sx={{ fontSize: '0.8125rem', color: colors.textSecondary, lineHeight: 1.4 }}>{n.message}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted, mt: 0.25 }}>{timeAgo(n.createdAt)}</Typography>
                  </Box>
                  {!n.read && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colors.accent, mt: 0.75, flexShrink: 0 }} />}
                </Box>
              );
            })
          )}
        </Box>

        <Divider />
        <Box sx={{ p: 1 }}>
          <Button fullWidth onClick={viewAll} sx={{ textTransform: 'none', fontWeight: 600 }}>
            View all notifications
          </Button>
        </Box>
      </Menu>
    </>
  );
};

export default NotificationBell;
