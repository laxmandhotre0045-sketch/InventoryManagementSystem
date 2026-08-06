import { useState } from 'react';
import {
  AppBar, Toolbar, Box, IconButton, Typography, Avatar, Menu,
  MenuItem, Divider, ListItemIcon, useTheme, useMediaQuery,
} from '@mui/material';
import { Menu as MenuIcon, PanelLeftClose, PanelLeft, LogOut, LayoutGrid, Settings, CalendarDays } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { roleLabel } from '../../utils/roleUtils';
import SearchBar from '../ui/SearchBar';
import NotificationBell from '../common/NotificationBell';
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
  '/notifications': 'Notifications',
  '/settings': 'Settings',
};

const Navbar = ({ onMenuClick, onToggleCollapse, collapsed, sidebarWidth }) => {
  const { email, role, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [anchorEl, setAnchorEl] = useState(null);
  const [query, setQuery] = useState('');

  const pageKey = Object.keys(ROUTE_TITLES).find((k) => location.pathname.startsWith(k));
  const pageTitle = ROUTE_TITLES[pageKey] || 'Overview';
  const initial = (email || 'U').charAt(0).toUpperCase();
  const todayLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Global search hands the term to the Components page, which owns the real
  // catalogue filter (code, name, category, location).
  const submitSearch = (e) => {
    if (e.key !== 'Enter') return;
    const term = query.trim();
    if (!term) return;
    navigate(`/components?q=${encodeURIComponent(term)}`);
    setQuery('');
  };

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
      <Toolbar sx={{ height: layout.navbarHeight, minHeight: layout.navbarHeight, px: { xs: 1.5, md: 2.5 }, gap: 1.5 }}>
        {/* Mobile menu / desktop collapse */}
        <IconButton size="small" onClick={isMobile ? onMenuClick : onToggleCollapse} sx={{ color: colors.textSecondary }}>
          {isMobile ? <MenuIcon size={19} /> : collapsed ? <PanelLeft size={17} /> : <PanelLeftClose size={17} />}
        </IconButton>

        {/* Page title */}
        <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.008em', minWidth: 0 }} noWrap>
          {pageTitle}
        </Typography>

        <Box sx={{ flexGrow: 1 }} />

        {/* Current date */}
        <Box sx={{ display: { xs: 'none', lg: 'flex' }, alignItems: 'center', gap: 0.75, mr: 0.5, color: colors.textMuted }}>
          <CalendarDays size={15} />
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 500 }}>{todayLabel}</Typography>
        </Box>

        {/* Search (desktop only — every page carries its own filter bar on mobile) */}
        {!isMobile && (
          <SearchBar
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={submitSearch}
            placeholder="Search components…"
            width={240}
            sx={{ bgcolor: colors.canvas }}
            inputProps={{ 'aria-label': 'Search components' }}
          />
        )}

        {/* Notifications — dynamic bell */}
        <NotificationBell />

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
              width: 30, height: 30, fontSize: '0.75rem', fontWeight: 600,
              bgcolor: colors.primary,
            }}
          >
            {initial}
          </Avatar>
          <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'left', minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.25 }} noWrap>
              {email?.split('@')[0] || 'User'}
            </Typography>
            <Typography sx={{ fontSize: '0.6875rem', color: colors.textMuted, lineHeight: 1.25 }}>
              {roleLabel(role)}
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
              {roleLabel(role)}
            </Typography>
          </Box>
          <Divider />
          <MenuItem onClick={() => { setAnchorEl(null); navigate('/modules'); }}>
            <ListItemIcon><LayoutGrid size={18} /></ListItemIcon>
            Switch Module
          </MenuItem>
          {role === 'ADMIN' && (
            <MenuItem onClick={() => { setAnchorEl(null); navigate('/settings'); }}>
              <ListItemIcon><Settings size={18} /></ListItemIcon>
              Settings
            </MenuItem>
          )}
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
