import {
  Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Box, Tooltip, Typography, useTheme, useMediaQuery,
} from '@mui/material';
import {
  LayoutDashboard, BookOpen, BookUp, BookDown, BookMarked,
  History, Users, BarChart3, Settings, ArrowLeftRight,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import BrandLogo from '../ui/BrandLogo';
import { colors, layout } from '../../theme/tokens';

// The Library module has its own dedicated navigation, independent of Inventory.
const DRAWER_WIDTH = layout.sidebarWidth;
const COLLAPSED_WIDTH = layout.sidebarCollapsedWidth;

const menuItems = [
  { label: 'Dashboard', path: '/library/dashboard', icon: LayoutDashboard },
  { label: 'Books', path: '/library/books', icon: BookOpen },
  { label: 'Issue Book', path: '/library/issue', icon: BookUp },
  { label: 'Return Book', path: '/library/return', icon: BookDown },
  { label: 'Issued Books', path: '/library/issued', icon: BookMarked },
  { label: 'Book History', path: '/library/history', icon: History },
  { label: 'Members', path: '/library/members', icon: Users },
  { label: 'Reports', path: '/library/reports', icon: BarChart3 },
  { label: 'Settings', path: '/library/settings', icon: Settings },
];

const LibrarySidebar = ({ mobileOpen, onClose, collapsed = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isCollapsed = collapsed && !isMobile;
  const width = isCollapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH;

  const handleNav = (path) => {
    navigate(path);
    if (isMobile) onClose();
  };

  const navButton = (item, isSwitch = false) => {
    const selected = !isSwitch && location.pathname.startsWith(item.path);
    const Icon = item.icon;
    const button = (
      <ListItemButton
        key={item.path}
        selected={selected}
        onClick={() => handleNav(item.path)}
        disableRipple
        sx={{
          position: 'relative',
          borderRadius: '8px',
          minHeight: isSwitch ? 40 : 42,
          py: 0.5,
          px: isCollapsed ? 0 : 1.5,
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          color: selected ? colors.primary : (isSwitch ? colors.textSecondary : '#565C68'),
          bgcolor: selected ? colors.sidebarActive : 'transparent',
          transition: 'background-color .18s ease, color .18s ease',
          '&:hover': { bgcolor: selected ? colors.sidebarActive : colors.hover, color: selected ? colors.primary : colors.textPrimary },
          '&.Mui-selected': { bgcolor: colors.sidebarActive },
          '&.Mui-selected:hover': { bgcolor: colors.sidebarActive },
          ...(selected && !isCollapsed
            ? { '&::before': { content: '""', position: 'absolute', left: -6, top: 9, bottom: 9, width: 3, borderRadius: '0 3px 3px 0', bgcolor: colors.primary } }
            : {}),
        }}
      >
        <ListItemIcon sx={{ minWidth: isCollapsed ? 0 : 32, color: 'inherit', justifyContent: 'center' }}>
          <Icon size={18} strokeWidth={selected ? 2.2 : 1.8} />
        </ListItemIcon>
        {!isCollapsed && (
          <ListItemText
            primary={item.label}
            primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: selected ? 600 : 500, letterSpacing: 0 }}
          />
        )}
      </ListItemButton>
    );
    return isCollapsed ? (
      <Tooltip key={item.path} title={item.label} placement="right">{button}</Tooltip>
    ) : button;
  };

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: colors.sidebar }}>
      {/* Logo + module label */}
      <Box
        sx={{
          height: layout.navbarHeight, display: 'flex', alignItems: 'center',
          px: isCollapsed ? 0 : 2, justifyContent: isCollapsed ? 'center' : 'flex-start', flexShrink: 0,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        {isCollapsed ? (
          <Box
            component="img"
            src="/sensovibe-mark.svg"
            alt="SensoVibe"
            sx={{ height: 30, width: 'auto', display: 'block' }}
          />
        ) : (
          <BrandLogo height={28} />
        )}
      </Box>
      {!isCollapsed && (
        <Box sx={{ px: 2, pt: 1.75, pb: 0.5 }}>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.textMuted }}>
            Book Management
          </Typography>
        </Box>
      )}

      {/* Navigation */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: isCollapsed ? 1.25 : 1.5, pt: 0.5 }}>
        <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {menuItems.map((item) => navButton(item))}
        </List>
      </Box>

      {/* Switch module */}
      <Box sx={{ px: isCollapsed ? 1.25 : 1.5, pb: 1.5, pt: 1, borderTop: `1px solid ${colors.border}` }}>
        <List disablePadding>
          {navButton({ label: 'Switch Module', path: '/modules', icon: ArrowLeftRight }, true)}
        </List>
      </Box>
    </Box>
  );

  return (
    <Box component="nav" sx={{ width: { md: width }, flexShrink: { md: 0 }, transition: 'width .2s ease' }}>
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? mobileOpen : true}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          '& .MuiDrawer-paper': {
            width, boxSizing: 'border-box', borderRight: `1px solid ${colors.border}`,
            transition: 'width .2s ease', overflowX: 'hidden',
          },
        }}
      >
        {drawer}
      </Drawer>
    </Box>
  );
};

export { DRAWER_WIDTH, COLLAPSED_WIDTH };
export default LibrarySidebar;
