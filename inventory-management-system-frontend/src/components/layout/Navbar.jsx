import { useState } from 'react';
import {
  AppBar, Toolbar, Box, IconButton, Typography, Badge, Avatar, Menu,
  MenuItem, Divider, ListItemIcon, Tooltip, useTheme, useMediaQuery,
} from '@mui/material';
import { Menu as MenuIcon, PanelLeftClose, PanelLeft, Bell, Search, LogOut, User, Settings, CalendarDays } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import SearchBar from '../ui/SearchBar';
import { colors, layout } from '../../theme/tokens';

const ROUTE_TITLES = {
  '/dashboard': 'Dashboard',
  '/equipment': 'Equipment',
  '/components': 'Components',
  '/inventory': 'Inventory',
  '/projects': 'Projects',
  '/purchases': 'Purchases',
  '/suppliers': 'Suppliers',
  '/reports': 'Reports',
};

const Navbar = ({ onMenuClick, onToggleCollapse, collapsed, sidebarWidth }) => {
  const { email, role, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [anchorEl, setAnchorEl] = useState(null);

  const pageKey = Object.keys(ROUTE_TITLES).find((k) => location.pathname.startsWith(k));
  const pageTitle = ROUTE_TITLES[pageKey] || 'Overview';
  const initial = (email || 'U').charAt(0).toUpperCase();
  const todayLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: { md: `calc(100% - ${sidebarWidth}px)` },
        ml: { md: `${sidebarWidth}px` },
        bgcolor: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(8px)',
        color: colors.textPrimary,
        borderBottom: `1px solid ${colors.border}`,
        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
        transition: 'width .2s ease, margin .2s ease',
      }}
    >
      <Toolbar sx={{ height: layout.navbarHeight, minHeight: layout.navbarHeight, px: { xs: 2, md: 3 }, gap: 2 }}>
        {/* Mobile menu / desktop collapse */}
        <IconButton onClick={isMobile ? onMenuClick : onToggleCollapse} sx={{ color: colors.textSecondary }}>
          {isMobile ? <MenuIcon size={22} /> : collapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
        </IconButton>

        {/* Page title */}
        <Typography sx={{ fontSize: '1.375rem', fontWeight: 600, letterSpacing: '-0.015em', minWidth: 0 }} noWrap>
          {pageTitle}
        </Typography>

        <Box sx={{ flexGrow: 1 }} />

        {/* Current date */}
        <Box sx={{ display: { xs: 'none', lg: 'flex' }, alignItems: 'center', gap: 1, mr: 0.5, color: colors.textSecondary }}>
          <CalendarDays size={18} />
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 500 }}>{todayLabel}</Typography>
        </Box>

        {/* Search (desktop) */}
        {!isMobile && (
          <SearchBar placeholder="Search components, equipment…" width={280} sx={{ bgcolor: colors.canvas }} />
        )}
        {isMobile && (
          <IconButton sx={{ color: colors.textSecondary }}>
            <Search size={20} />
          </IconButton>
        )}

        {/* Notifications */}
        <Tooltip title="3 new alerts">
          <IconButton sx={{ color: colors.textSecondary }}>
            <Badge
              badgeContent={3}
              sx={{ '& .MuiBadge-badge': { bgcolor: colors.accent, color: '#fff', fontSize: '0.6875rem', fontWeight: 700, minWidth: 18, height: 18, boxShadow: '0 0 0 2px #fff' } }}
            >
              <Bell size={21} />
            </Badge>
          </IconButton>
        </Tooltip>

        {/* Profile */}
        <Box
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1, pl: 1, cursor: 'pointer', borderRadius: '10px',
            transition: 'background-color .18s ease', '&:hover': { bgcolor: colors.hover }, py: 0.5, pr: { xs: 0.5, sm: 1 },
          }}
        >
          <Avatar
            sx={{
              width: 38, height: 38, fontSize: '0.9375rem', fontWeight: 600,
              bgcolor: colors.primary,
            }}
          >
            {initial}
          </Avatar>
          <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'left', minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.2 }} noWrap>
              {email?.split('@')[0] || 'User'}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted, lineHeight: 1.2 }}>
              {role === 'ADMIN' ? 'Administrator' : 'Member'}
            </Typography>
          </Box>
        </Box>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { sx: { minWidth: 230 } } }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }} noWrap>{email}</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted }}>
              {role === 'ADMIN' ? 'Administrator' : 'Member'}
            </Typography>
          </Box>
          <Divider />
          <MenuItem onClick={() => setAnchorEl(null)}>
            <ListItemIcon><User size={18} /></ListItemIcon>
            My Profile
          </MenuItem>
          <MenuItem onClick={() => setAnchorEl(null)}>
            <ListItemIcon><Settings size={18} /></ListItemIcon>
            Settings
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => { setAnchorEl(null); logout(); }}
            sx={{ color: colors.danger, '& .MuiListItemIcon-root': { color: colors.danger } }}
          >
            <ListItemIcon><LogOut size={18} /></ListItemIcon>
            Log out
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
