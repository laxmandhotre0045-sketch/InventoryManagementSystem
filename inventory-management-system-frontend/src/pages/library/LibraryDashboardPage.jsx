import { useEffect, useState } from 'react';
import { Box, Grid, Typography, Divider } from '@mui/material';
import {
  BookOpen, Layers, CheckCircle2, BookMarked, AlertTriangle, Users,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts';
import { getLibraryDashboard } from '../../api/library/dashboardApi';
import { PageHeader, MetricCard, ChartCard, StatusBadge, EmptyState } from '../../components/ui';
import { issueBadge, formatDate } from '../../utils/libraryStatus';
import { colors, tints } from '../../theme/tokens';

const CHART_COLORS = [tints.blue.fg, tints.green.fg, tints.orange.fg, tints.purple.fg, tints.red.fg, colors.primary];

const ActivityList = ({ items, emptyLabel }) => {
  if (!items || items.length === 0) {
    return <EmptyState icon={BookMarked} title="Nothing yet" description={emptyLabel} dense />;
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((r, i) => (
        <Box key={r.id}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, py: 1.5 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }} noWrap>{r.bookTitle}</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted }} noWrap>
                {r.memberName} · {formatDate(r.returnDate || r.issueDate)}
              </Typography>
            </Box>
            <StatusBadge {...issueBadge(r.effectiveStatus)} />
          </Box>
          {i < items.length - 1 && <Divider />}
        </Box>
      ))}
    </Box>
  );
};

const LibraryDashboardPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLibraryDashboard()
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const metrics = [
    { title: 'Total Books', value: data?.totalBooks, icon: BookOpen, tone: 'primary' },
    { title: 'Total Copies', value: data?.totalCopies, icon: Layers, tone: 'purple' },
    { title: 'Available', value: data?.availableBooks, icon: CheckCircle2, tone: 'success' },
    { title: 'Issued', value: data?.issuedBooks, icon: BookMarked, tone: 'warning' },
    { title: 'Overdue', value: data?.overdueBooks, icon: AlertTriangle, tone: 'danger' },
    { title: 'Members', value: data?.activeMembers, icon: Users, tone: 'info' },
  ];

  const chartData = (data?.booksByCategory || []).slice(0, 6).map((c) => ({ name: c.category, count: c.count }));

  return (
    <Box>
      <PageHeader
        title="Library Dashboard"
        subtitle="An overview of your collection, loans and members."
        icon={BookOpen}
        breadcrumbs={[{ label: 'Library' }, { label: 'Dashboard' }]}
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {metrics.map((m) => (
          <Grid item xs={12} sm={6} md={4} lg={2} key={m.title}>
            <MetricCard title={m.title} value={m.value?.toLocaleString?.() ?? m.value} icon={m.icon} tone={m.tone} loading={loading} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={7}>
          <ChartCard title="Books by Category" subtitle="Distribution of titles across categories">
            {chartData.length === 0 ? (
              <EmptyState icon={Layers} title="No categories yet" description="Add books with categories to see this chart." dense />
            ) : (
              <Box sx={{ height: 320, mt: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: colors.textSecondary }} tickLine={false} axisLine={{ stroke: colors.border }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: colors.textSecondary }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: colors.hover }} contentStyle={{ borderRadius: 12, border: `1px solid ${colors.border}`, fontSize: 13 }} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={54}>
                      {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
          </ChartCard>
        </Grid>

        <Grid item xs={12} lg={5}>
          <ChartCard title="Recently Issued" subtitle="Latest loans">
            <ActivityList items={data?.recentlyIssued} emptyLabel="No books have been issued yet." />
          </ChartCard>
        </Grid>

        {/* Full width: paired with a 7-column card it left a dead 5-column gap. */}
        <Grid item xs={12}>
          <ChartCard title="Recently Returned" subtitle="Latest returns">
            <ActivityList items={data?.recentlyReturned} emptyLabel="No books have been returned yet." />
          </ChartCard>
        </Grid>
      </Grid>
    </Box>
  );
};

export default LibraryDashboardPage;
