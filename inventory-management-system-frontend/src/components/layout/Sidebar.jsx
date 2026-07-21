import {
  Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Box, Typography, useTheme, useMediaQuery,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import MemoryIcon from '@mui/icons-material/Memory';
import InventoryIcon from '@mui/icons-material/Inventory';
import FolderIcon from '@mui/icons-material/Folder';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import StoreIcon from '@mui/icons-material/Store';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { isAdmin } from '../../utils/roleUtils';

const DRAWER_WIDTH = 260;

const allMenuItems = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon />, roles: ['ADMIN', 'USER'] },
  { label: 'Equipment', path: '/equipment', icon: <PrecisionManufacturingIcon />, roles: ['ADMIN', 'USER'] },
  { label: 'Components', path: '/components', icon: <MemoryIcon />, roles: ['ADMIN', 'USER'] },
  { label: 'Inventory', path: '/inventory', icon: <InventoryIcon />, roles: ['ADMIN'] },
  { label: 'Projects', path: '/projects', icon: <FolderIcon />, roles: ['ADMIN', 'USER'] },
  { label: 'Purchases', path: '/purchases', icon: <ShoppingCartIcon />, roles: ['ADMIN'] },
  { label: 'Suppliers', path: '/suppliers', icon: <StoreIcon />, roles: ['ADMIN'] },
  { label: 'Reports', path: '/reports', icon: <AssessmentIcon />, roles: ['ADMIN'] },
];

const Sidebar = ({ mobileOpen, onClose }) => {
  const { role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const menuItems = allMenuItems.filter((item) =>
    isAdmin(role) ? item.roles.includes('ADMIN') : item.roles.includes('USER')
  );

  const drawer = (
    <Box>
      <Toolbar sx={{ px: 2.5 }}>
        <Typography variant="h6" color="primary" fontWeight={700} noWrap>
          IMS
        </Typography>
      </Toolbar>
      <List sx={{ px: 1 }}>
        {menuItems.map((item) => {
          const selected = location.pathname.startsWith(item.path);
          return (
            <ListItemButton
              key={item.path}
              selected={selected}
              onClick={() => { navigate(item.path); if (isMobile) onClose(); }}
              sx={{ borderRadius: 2, mb: 0.5 }}
            >
              <ListItemIcon sx={{ color: selected ? 'primary.main' : 'inherit', minWidth: 40 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? mobileOpen : true}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        {drawer}
      </Drawer>
    </Box>
  );
};

export { DRAWER_WIDTH };
export default Sidebar;
