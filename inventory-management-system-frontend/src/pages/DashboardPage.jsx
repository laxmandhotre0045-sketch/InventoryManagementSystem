import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Grid, Typography, Chip, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
} from '@mui/material';
import {
  getDashboardSummary, getLowStock, getRecentPurchases,
  getRecentTransactions, getProjectSummary,
} from '../api/dashboardApi';
import { useAuth } from '../auth/AuthContext';
import { isAdmin } from '../utils/roleUtils';

const StatCard = ({ title, value, color }) => (
  <Card>
    <CardContent>
      <Typography variant="body2" color="text.secondary" gutterBottom>{title}</Typography>
      <Typography variant="h4" fontWeight={700} color={color || 'text.primary'}>{value ?? '—'}</Typography>
    </CardContent>
  </Card>
);

const DashboardPage = () => {
  const { role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [recentPurchases, setRecentPurchases] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [projectSummary, setProjectSummary] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [s, ls, ps, ts, proj] = await Promise.all([
          getDashboardSummary(),
          getLowStock(),
          getRecentPurchases(5),
          getRecentTransactions(5),
          getProjectSummary(),
        ]);
        setSummary(s);
        setLowStock(ls);
        setRecentPurchases(ps);
        setRecentTransactions(ts);
        setProjectSummary(proj);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>Dashboard</Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <StatCard title="Total Components" value={summary?.totalComponents} color="primary.main" />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <StatCard title="Total Equipment" value={summary?.totalEquipment} color="primary.main" />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <StatCard title="Available Stock" value={summary?.totalAvailableStock} color="success.main" />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <StatCard title="Total Value" value={`$${summary?.totalInventoryValue?.toFixed(2) || '0.00'}`} color="text.primary" />
        </Grid>
        
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <StatCard title="Low Stock" value={summary?.lowStockComponents} color="warning.main" />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <StatCard title="Out of Stock" value={summary?.outOfStockComponents} color="error.main" />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <StatCard title="Active Projects" value={summary?.activeProjects} color="info.main" />
        </Grid>
        
        {isAdmin(role) && (
          <Grid item xs={12} sm={6} md={4} lg={3}>
            <StatCard title="Purchases This Month" value={summary?.purchasesThisMonth} color="secondary.main" />
          </Grid>
        )}
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Typography variant="h6" sx={{ mb: 1 }}>Low Stock Components</Typography>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Component</TableCell>
                  <TableCell>Qty</TableCell>
                  <TableCell>Min</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lowStock.length === 0 ? (
                  <TableRow><TableCell colSpan={3} align="center">No low stock items</TableCell></TableRow>
                ) : lowStock.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.componentName}</TableCell>
                    <TableCell><Chip label={row.quantity} color="error" size="small" /></TableCell>
                    <TableCell>{row.minimumQuantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>

        <Grid item xs={12} md={6}>
          <Typography variant="h6" sx={{ mb: 1 }}>Project Summary</Typography>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Project</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Usage</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {projectSummary.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.projectName}</TableCell>
                    <TableCell><Chip label={row.status} size="small" /></TableCell>
                    <TableCell>{row.totalComponentUsage}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>

        {isAdmin(role) && (
          <>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ mb: 1 }}>Recent Purchases</Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Supplier</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentPurchases.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.supplierName}</TableCell>
                        <TableCell>{row.purchaseDate}</TableCell>
                        <TableCell align="right">{row.totalAmount?.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ mb: 1 }}>Recent Transactions</Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Component</TableCell>
                      <TableCell>Qty</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentTransactions.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Chip
                            label={row.transactionType}
                            size="small"
                            color={row.transactionType === 'STOCK_IN' ? 'success' : 'warning'}
                          />
                        </TableCell>
                        <TableCell>{row.componentName}</TableCell>
                        <TableCell>{row.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </>
        )}
      </Grid>
    </Box>
  );
};

export default DashboardPage;
