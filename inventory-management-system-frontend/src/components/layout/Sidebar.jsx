import {
  Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Box, Tooltip, useTheme, useMediaQuery,
} from '@mui/material';
import {
  LayoutDashboard, Cpu, CircuitBoard, Boxes, FolderKanban,
  ShoppingCart, Store, BarChart3,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { isAdmin } from '../../utils/roleUtils';
import { colors, layout } from '../../theme/tokens';

const DRAWER_WIDTH = layout.sidebarWidth;
const COLLAPSED_WIDTH = layout.sidebarCollapsedWidth;

// Flat, minimal navigation — no group headings (kept intentionally clean).
const menuItems = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'USER'] },
  { label: 'Equipment', path: '/equipment', icon: Cpu, roles: ['ADMIN', 'USER'] },
  { label: 'Components', path: '/components', icon: CircuitBoard, roles: ['ADMIN', 'USER'] },
  { label: 'Inventory', path: '/inventory', icon: Boxes, roles: ['ADMIN'] },
  { label: 'Projects', path: '/projects', icon: FolderKanban, roles: ['ADMIN', 'USER'] },
  { label: 'Purchases', path: '/purchases', icon: ShoppingCart, roles: ['ADMIN'] },
  { label: 'Suppliers', path: '/suppliers', icon: Store, roles: ['ADMIN'] },
  { label: 'Reports', path: '/reports', icon: BarChart3, roles: ['ADMIN'] },
];

const Sidebar = ({ mobileOpen, onClose, collapsed = false }) => {
  const { role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isCollapsed = collapsed && !isMobile;
  const width = isCollapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH;

  const items = menuItems.filter((item) =>
    isAdmin(role) ? item.roles.includes('ADMIN') : item.roles.includes('USER')
  );

  const handleNav = (path) => {
    navigate(path);
    if (isMobile) onClose();
  };

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: colors.sidebar }}>
      {/* Logo — the main visual element of the sidebar */}
      <Box
        sx={{
          minHeight: layout.navbarHeight,
          display: 'flex',
          alignItems: 'center',
          px: isCollapsed ? 0 : 3,
          py: 2.5,
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          flexShrink: 0,
        }}
      >
        <Box
          component="img"
          src={isCollapsed ? '/sensovibe-mark.svg' : '/sensovibe-logo.svg'}
          alt="SensoVibe"
          sx={{ height: isCollapsed ? 40 : 38, width: 'auto', display: 'block' }}
        />
      </Box>

      {/* Navigation */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: isCollapsed ? 1.5 : 2.25, pt: 1.75 }}>
        <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 1.375 }}>
          {items.map((item) => {
            const selected = location.pathname.startsWith(item.path);
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
                  minHeight: 60,
                  py: 1,
                  px: isCollapsed ? 0 : 2.5,
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  color: selected ? colors.primary : '#565C68',
                  bgcolor: selected ? colors.sidebarActive : 'transparent',
                  transition: 'background-color .18s ease, color .18s ease, transform .18s ease',
                  '&:hover': { bgcolor: selected ? colors.sidebarActive : colors.hover, color: selected ? colors.primary : colors.textPrimary },
                  '&:hover .nav-ico': { transform: 'scale(1.08)' },
                  '&.Mui-selected': { bgcolor: colors.sidebarActive },
                  '&.Mui-selected:hover': { bgcolor: colors.sidebarActive },
                  ...(selected && !isCollapsed
                    ? { '&::before': { content: '""', position: 'absolute', left: 0, top: 13, bottom: 13, width: 4, borderRadius: '0 4px 4px 0', bgcolor: colors.primary } }
                    : {}),
                }}
              >
                <ListItemIcon className="nav-ico" sx={{ minWidth: isCollapsed ? 0 : 50, color: 'inherit', justifyContent: 'center', transition: 'transform .18s ease' }}>
                  <Icon size={29} strokeWidth={selected ? 2.3 : 1.9} />
                </ListItemIcon>
                {!isCollapsed && (
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{ fontSize: '1.25rem', fontWeight: selected ? 700 : 600, letterSpacing: '-0.01em' }}
                  />
                )}
              </ListItemButton>
            );
            return isCollapsed ? (
              <Tooltip key={item.path} title={item.label} placement="right">{button}</Tooltip>
            ) : button;
          })}
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
            width,
            boxSizing: 'border-box',
            borderRight: `1px solid ${colors.border}`,
            transition: 'width .2s ease',
            overflowX: 'hidden',
          },
        }}
      >
        {drawer}
      </Drawer>
    </Box>
  );
};

export { DRAWER_WIDTH, COLLAPSED_WIDTH };
export default Sidebar;
