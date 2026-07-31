import { useState } from 'react';
import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import LibraryNavbar from './LibraryNavbar';
import LibrarySidebar, { DRAWER_WIDTH, COLLAPSED_WIDTH } from './LibrarySidebar';
import { colors, layout } from '../../theme/tokens';

// Dedicated shell for the Book Management module — its own sidebar + navbar,
// completely separate from the Inventory Management layout.
const LibraryLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const sidebarWidth = collapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: colors.canvas }}>
      <LibraryNavbar
        onMenuClick={() => setMobileOpen(true)}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        collapsed={collapsed}
        sidebarWidth={sidebarWidth}
      />
      <LibrarySidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={collapsed}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${sidebarWidth}px)` },
          minWidth: 0,
          transition: 'width .2s ease',
        }}
      >
        <Box sx={{ height: layout.navbarHeight }} />
        <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1440, mx: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default LibraryLayout;
