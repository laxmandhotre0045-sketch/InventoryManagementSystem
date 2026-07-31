import {
  Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Box, Tooltip, Typography, useTheme, useMediaQuery,
} from '@mui/material';
import {
  LayoutDashboard, BookOpen, BookUp, BookDown, BookMarked,
  History, Users, BarChart3, Settings, ArrowLeftRight,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
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
          borderRadius: '11px',
          minHeight: isSwitch ? 52 : 56,
          py: 1,
          px: isCollapsed ? 0 : 2.25,
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          color: selected ? colors.primary : (isSwitch ? colors.textSecondary : '#565C68'),
          bgcolor: selected ? colors.sidebarActive : 'transparent',
          transition: 'background-color .18s ease, color .18s ease',
          '&:hover': { bgcolor: selected ? colors.sidebarActive : colors.hover, color: selected ? colors.primary : colors.textPrimary },
          '&.Mui-selected': { bgcolor: colors.sidebarActive },
          '&.Mui-selected:hover': { bgcolor: colors.sidebarActive },
          ...(selected && !isCollapsed
            ? { '&::before': { content: '""', position: 'absolute', left: 0, top: 12, bottom: 12, width: 4, borderRadius: '0 4px 4px 0', bgcolor: colors.primary } }
            : {}),
        }}
      >
        <ListItemIcon sx={{ minWidth: isCollapsed ? 0 : 46, color: 'inherit', justifyContent: 'center' }}>
          <Icon size={26} strokeWidth={selected ? 2.3 : 1.9} />
        </ListItemIcon>
        {!isCollapsed && (
          <ListItemText
            primary={item.label}
            primaryTypographyProps={{ fontSize: '1.15rem', fontWeight: selected ? 700 : 600, letterSpacing: '-0.01em' }}
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
          minHeight: layout.navbarHeight, display: 'flex', alignItems: 'center',
          px: isCollapsed ? 0 : 3, py: 2, justifyContent: isCollapsed ? 'center' : 'flex-start', flexShrink: 0,
        }}
      >
        <Box
          component="img"
          src={isCollapsed ? '/sensovibe-mark.svg' : '/sensovibe-logo.svg'}
          alt="SensoVibe"
          sx={{ height: isCollapsed ? 40 : 34, width: 'auto', display: 'block' }}
        />
      </Box>
      {!isCollapsed && (
        <Box sx={{ px: 3, pb: 1.5 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.primary }}>
            Book Management
          </Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: colors.textMuted }}>Library System</Typography>
        </Box>
      )}

      {/* Navigation */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: isCollapsed ? 1.5 : 2.25, pt: 1 }}>
        <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {menuItems.map((item) => navButton(item))}
        </List>
      </Box>

      {/* Switch module */}
      <Box sx={{ px: isCollapsed ? 1.5 : 2.25, pb: 2.5, pt: 1, borderTop: `1px solid ${colors.border}` }}>
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
