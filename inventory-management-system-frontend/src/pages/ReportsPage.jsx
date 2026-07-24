import { Box, Grid, Card, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, Boxes, AlertTriangle, ShoppingCart, FolderKanban, ArrowRight, Cpu,
} from 'lucide-react';
import { PageHeader } from '../components/ui';
import { colors } from '../theme/tokens';

const reports = [
  { title: 'Inventory Report', description: 'Full component list with quantities, units, and stock status.', icon: Boxes, tone: 'primary', to: '/components' },
  { title: 'Low Stock Report', description: 'Components at or below their minimum reorder threshold.', icon: AlertTriangle, tone: 'warning', to: '/components' },
  { title: 'Stock Movement', description: 'Complete history of stock-in and stock-out transactions.', icon: BarChart3, tone: 'info', to: '/inventory' },
  { title: 'Purchase Report', description: 'Purchase orders, invoices, and procurement spend over time.', icon: ShoppingCart, tone: 'success', to: '/purchases' },
  { title: 'Equipment Report', description: 'Registered assets, statuses, and maintenance overview.', icon: Cpu, tone: 'primary', to: '/equipment' },
  { title: 'Project Usage', description: 'Component consumption broken down by project.', icon: FolderKanban, tone: 'info', to: '/projects' },
];

const toneMap = {
  primary: { fg: colors.primary, bg: colors.primarySoft },
  success: { fg: colors.success, bg: colors.successSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  info: { fg: colors.info, bg: colors.infoSoft },
};

const ReportsPage = () => {
  const navigate = useNavigate();

  return (
    <Box>
      <PageHeader
        title="Reports"
        subtitle="Explore inventory, procurement, and project reports in one place."
        icon={BarChart3}
        breadcrumbs={[{ label: 'Procurement' }, { label: 'Reports' }]}
      />

      <Grid container spacing={3}>
        {reports.map((r) => {
          const t = toneMap[r.tone];
          const Icon = r.icon;
          return (
            <Grid item xs={12} sm={6} lg={4} key={r.title}>
              <Card
                sx={{
                  p: 3, height: '100%', display: 'flex', flexDirection: 'column',
                  transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease',
                  '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 6px 24px rgba(15,23,42,0.08)', borderColor: '#DBE3EF' },
                }}
              >
                <Box sx={{ width: 46, height: 46, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: t.bg, color: t.fg, mb: 2 }}>
                  <Icon size={22} />
                </Box>
                <Typography sx={{ fontSize: '1rem', fontWeight: 600, mb: 0.5 }}>{r.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1, mb: 2 }}>
                  {r.description}
                </Typography>
                <Button
                  variant="outlined"
                  endIcon={<ArrowRight size={16} />}
                  onClick={() => navigate(r.to)}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  View report
                </Button>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default ReportsPage;
