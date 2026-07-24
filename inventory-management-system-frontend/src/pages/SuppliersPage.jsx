import { useEffect, useMemo, useState } from 'react';
import { Box, Grid, Snackbar, Alert, Avatar } from '@mui/material';
import { Store, Users, DollarSign, ShoppingCart } from 'lucide-react';
import { getPurchases } from '../api/purchaseApi';
import DataTable from '../components/common/DataTable';
import { PageHeader, MetricCard } from '../components/ui';
import { colors } from '../theme/tokens';

import { formatCurrency as currency } from '../utils/currency';


// Suppliers are derived from existing purchase records (no separate API/backend
// change): distinct supplier names with order counts, total spend, and last order.
const SuppliersPage = () => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'error' });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await getPurchases({ page: 0, size: 500, sortBy: 'purchaseDate', sortDir: 'desc' });
        setPurchases(res.data?.content || []);
      } catch (err) {
        setSnack({ open: true, message: err.response?.data?.message || 'Failed to load suppliers', severity: 'error' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const suppliers = useMemo(() => {
    const map = new Map();
    purchases.forEach((p) => {
      const name = p.supplierName || 'Unknown';
      const cur = map.get(name) || { name, orders: 0, totalSpend: 0, lastDate: '' };
      cur.orders += 1;
      cur.totalSpend += Number(p.totalAmount || 0);
      if (!cur.lastDate || (p.purchaseDate && p.purchaseDate > cur.lastDate)) cur.lastDate = p.purchaseDate || cur.lastDate;
      map.set(name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.totalSpend - a.totalSpend);
  }, [purchases]);

  const totalSpend = suppliers.reduce((s, x) => s + x.totalSpend, 0);
  const totalOrders = suppliers.reduce((s, x) => s + x.orders, 0);

  const columns = [
    {
      field: 'name', headerName: 'Supplier',
      render: (row) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ width: 34, height: 34, fontSize: '0.875rem', fontWeight: 600, bgcolor: colors.primarySoft, color: colors.primary }}>
            {row.name.charAt(0).toUpperCase()}
          </Avatar>
          <Box component="span" sx={{ fontWeight: 500 }}>{row.name}</Box>
        </Box>
      ),
    },
    { field: 'orders', headerName: 'Orders', align: 'right' },
    { field: 'totalSpend', headerName: 'Total Spend', align: 'right', render: (row) => <Box component="span" sx={{ fontWeight: 600 }}>{currency(row.totalSpend)}</Box> },
    { field: 'lastDate', headerName: 'Last Order' },
  ];

  return (
    <Box>
      <PageHeader
        title="Suppliers"
        subtitle="Suppliers and spend, aggregated from your purchase orders."
        icon={Store}
        breadcrumbs={[{ label: 'Procurement' }, { label: 'Suppliers' }]}
      />

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <MetricCard loading={loading} icon={Users} title="Total Suppliers" value={suppliers.length} tone="primary" caption="Distinct vendors" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <MetricCard loading={loading} icon={DollarSign} title="Total Spend" value={currency(totalSpend)} tone="success" caption="Across all orders" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <MetricCard loading={loading} icon={ShoppingCart} title="Total Orders" value={totalOrders} tone="info" caption="Purchase orders" />
        </Grid>
      </Grid>

      <DataTable
        columns={columns}
        rows={suppliers}
        rowKey="name"
        loading={loading}
        emptyState={{
          icon: Store,
          title: 'No suppliers yet',
          description: 'Suppliers appear here automatically once you record purchase orders.',
        }}
      />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack({ ...snack, open: false })}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default SuppliersPage;
