import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Grid, Alert, Button, Typography, LinearProgress, Tooltip, Avatar } from '@mui/material';
import {
  CircuitBoard, DollarSign, AlertTriangle, FolderKanban,
  ArrowDownLeft, ArrowUpRight, Download, Boxes, RotateCcw, MapPin, Truck, CalendarDays, UserRound,
} from 'lucide-react';
import { PieChart, Pie, Cell, Sector, Tooltip as RTooltip, ResponsiveContainer } from 'recharts';
import useCountUp from '../hooks/useCountUp';
import { getDashboardSummary, getLowStock, getRecentTransactions } from '../api/dashboardApi';
import { getProjects } from '../api/projectApi';
import { useAuth } from '../auth/AuthContext';
import { isAdmin } from '../utils/roleUtils';
import { MetricCard, ChartCard, StatusBadge, EmptyState } from '../components/ui';
import { colors } from '../theme/tokens';

import { formatCurrency as currency } from '../utils/currency';

const num = (n) => Number(n || 0).toLocaleString();

const dateLabel = (d) => (d ? new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const timeLabel = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '');

// Row treatment shared by every list section — consistent spacing + hover.
const rowSx = {
  py: 2.25, px: 1.75, mx: -1.75, borderRadius: 2.5,
  transition: 'background-color .18s ease',
  '&:hover': { bgcolor: colors.hover },
};

const metaSx = { display: 'inline-flex', alignItems: 'center', gap: 0.625, fontSize: '1rem', color: colors.textMuted };

const ChartTooltip = ({ active, payload, total }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const pct = total ? Math.round((p.value / total) * 100) : 0;
  return (
    <Box sx={{ bgcolor: colors.textPrimary, color: '#fff', px: 1.75, py: 1.25, borderRadius: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
        <Box sx={{ width: 9, height: 9, borderRadius: '2px', bgcolor: p.payload?.color }} />
        <Typography sx={{ fontSize: '1rem', fontWeight: 600 }}>{p.name}</Typography>
      </Box>
      <Typography sx={{ fontSize: '0.9375rem', color: '#D1D5DB' }}>
        {num(p.value)} components · {pct}%
      </Typography>
    </Box>
  );
};

/** Hovered slice grows slightly — a restrained lift, no bounce. */
const renderActiveSlice = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx} cy={cy}
      innerRadius={innerRadius} outerRadius={outerRadius + 6}
      startAngle={startAngle} endAngle={endAngle}
      cornerRadius={2} fill={fill}
    />
  );
};

// Timeline completion from status + date range (never fabricated).
const completionOf = (p) => {
  if (p.status === 'COMPLETED') return 100;
  if (p.status === 'ON_HOLD') return null;
  if (p.startDate && p.endDate) {
    const start = new Date(p.startDate).getTime();
    const end = new Date(p.endDate).getTime();
    const now = Date.now();
    if (end > start) return Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
  }
  return 0;
};

const DashboardPage = () => {
  const { role, email } = useAuth();
  const navigate = useNavigate();
  const admin = isAdmin(role);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activeSlice, setActiveSlice] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [s, ls, ts, proj] = await Promise.all([
          getDashboardSummary(),
          getLowStock(),
          getRecentTransactions(6),
          getProjects({ page: 0, size: 6, sortBy: 'startDate', sortDir: 'desc' }),
        ]);
        setSummary(s);
        setLowStock(ls || []);
        setRecentTransactions(ts || []);
        setProjects(proj?.data?.content || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const totalComponents = summary?.totalComponents || 0;
  const low = summary?.lowStockComponents || 0;
  const out = summary?.outOfStockComponents || 0;
  const healthy = Math.max(totalComponents - low - out, 0);
  // Memoised so the array identity only changes when the numbers actually do.
  // Without this a new array is created on every render (e.g. hovering a slice),
  // which makes Recharts restart/interrupt the draw animation.
  const stockStatus = useMemo(
    () => [
      { name: 'In stock', value: healthy, color: colors.success },
      { name: 'Low stock', value: low, color: colors.warning },
      { name: 'Out of stock', value: out, color: colors.danger },
    ].filter((d) => d.value > 0),
    [healthy, low, out]
  );

  // Centre figure counts up on load and tweens on refresh.
  const animatedTotal = useCountUp(totalComponents, 1100);
  // Re-runs the staggered legend entrance whenever the distribution changes.
  const legendKey = useMemo(() => stockStatus.map((d) => `${d.name}:${d.value}`).join('|'), [stockStatus]);

  const metrics = [
    { title: 'Total Stock Value', value: currency(summary?.totalInventoryValue), icon: DollarSign, tone: 'success', caption: 'Valuation across all components', tip: 'On-hand quantity × average purchased unit price' },
    { title: 'Total Components', value: num(totalComponents), icon: CircuitBoard, tone: 'info', caption: `${num(healthy)} within healthy levels`, tip: 'Active components in the catalogue' },
    { title: 'Low Stock Items', value: num(low), icon: AlertTriangle, tone: 'warning', caption: 'At or below reorder point', tip: 'Quantity is at or below the minimum level' },
    { title: 'Active Projects', value: num(summary?.activeProjects), icon: FolderKanban, tone: 'purple', caption: 'Currently in progress', tip: 'Projects with status ACTIVE' },
  ];

  const firstName = (email?.split('@')[0] || 'there').replace(/\b\w/, (c) => c.toUpperCase());
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const attention = low + out;
  const statusLine = attention === 0
    ? 'All components are within healthy stock levels.'
    : `${low} low-stock and ${out} out-of-stock item${attention === 1 ? '' : 's'} need attention.`;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, mb: 4.5 }}>
        <Box>
          <Typography variant="h1" sx={{ fontSize: { xs: '2.25rem', md: '2.625rem' }, mb: 1 }}>
            {greeting}, {firstName}
          </Typography>
          <Typography sx={{ fontSize: '1.25rem', color: colors.textSecondary }}>
            {today} · {statusLine}
          </Typography>
        </Box>
        {admin && (
          <Box sx={{ display: 'flex', gap: 1.75 }}>
            <Tooltip title="Download a snapshot of current stock levels">
              <Button variant="outlined" startIcon={<Download size={19} />}>Export</Button>
            </Tooltip>
            <Tooltip title="Record a stock in or stock out movement">
              <Button variant="contained" startIcon={<Boxes size={19} />} onClick={() => navigate('/inventory')}>Record Movement</Button>
            </Tooltip>
          </Box>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* KPIs */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {(loading ? Array.from({ length: 4 }) : metrics).map((m, i) => (
          <Grid item xs={12} sm={6} lg={3} key={m?.title || i}>
            {m?.tip ? (
              <Tooltip title={m.tip} placement="top" arrow>
                <Box sx={{ height: '100%' }}>
                  <MetricCard loading={loading} icon={m.icon} title={m.title} value={m.value} caption={m.caption} tone={m.tone} />
                </Box>
              </Tooltip>
            ) : (
              <MetricCard loading={loading} icon={m?.icon} title={m?.title} value={m?.value} caption={m?.caption} tone={m?.tone} />
            )}
          </Grid>
        ))}
      </Grid>

      {/* Stock health + low stock alerts */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} lg={5}>
          <ChartCard title="Stock Health" subtitle="Components by stock status">
            {stockStatus.length === 0 ? (
              <EmptyState dense icon={Boxes} title="No stock data" description="Component status will appear here once components exist." />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3.5, flexWrap: 'wrap' }}>
                <Box sx={{ position: 'relative', width: 216, height: 216, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stockStatus} dataKey="value" nameKey="name" cx="50%" cy="50%"
                        innerRadius={62} outerRadius={100} paddingAngle={2.5} stroke="none"
                        // Sweep clockwise from 12 o'clock on load, and tween
                        // between values when the data refreshes.
                        startAngle={90} endAngle={-270}
                        isAnimationActive
                        animationBegin={120}
                        animationDuration={1000}
                        animationEasing="ease-out"
                        activeIndex={activeSlice ?? undefined}
                        activeShape={renderActiveSlice}
                        onMouseEnter={(_, index) => setActiveSlice(index)}
                        onMouseLeave={() => setActiveSlice(null)}
                      >
                        {stockStatus.map((d) => <Cell key={d.name} fill={d.color} />)}
                      </Pie>
                      <RTooltip content={<ChartTooltip total={totalComponents} />} cursor={false} />
                    </PieChart>
                  </ResponsiveContainer>
                  <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography sx={{ fontSize: '2.375rem', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                        {num(animatedTotal)}
                      </Typography>
                      <Typography sx={{ fontSize: '0.9375rem', color: colors.textMuted, mt: 0.5 }}>Components</Typography>
                    </Box>
                  </Box>
                </Box>
                <Box key={legendKey} sx={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1, minWidth: 160 }}>
                  {stockStatus.map((d, i) => {
                    const pct = totalComponents ? Math.round((d.value / totalComponents) * 100) : 0;
                    const isActive = activeSlice === i;
                    return (
                      <Box
                        key={d.name}
                        onMouseEnter={() => setActiveSlice(i)}
                        onMouseLeave={() => setActiveSlice(null)}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'default',
                          px: 1, mx: -1, py: 0.5, borderRadius: 1.5,
                          bgcolor: isActive ? colors.hover : 'transparent',
                          transition: 'background-color .18s ease',
                          // Staggered fade-up as the chart finishes drawing.
                          opacity: 0,
                          animation: 'svLegendIn .45s cubic-bezier(.4,0,.2,1) forwards',
                          animationDelay: `${420 + i * 90}ms`,
                          '@keyframes svLegendIn': {
                            from: { opacity: 0, transform: 'translateY(6px)' },
                            to: { opacity: 1, transform: 'translateY(0)' },
                          },
                          '@media (prefers-reduced-motion: reduce)': {
                            opacity: 1, animation: 'none',
                          },
                        }}
                      >
                        <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: d.color, flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '1.125rem', flexGrow: 1, color: colors.textSecondary }}>{d.name}</Typography>
                        <Typography sx={{ fontSize: '0.9375rem', color: colors.textMuted }}>{pct}%</Typography>
                        <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, minWidth: 32, textAlign: 'right' }}>{num(d.value)}</Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            )}
          </ChartCard>
        </Grid>

        <Grid item xs={12} lg={7}>
          <ChartCard
            title="Low Stock Alerts"
            subtitle="Components at or below their reorder point"
            action={admin && lowStock.length > 0 ? (
              <Button variant="text" size="small" onClick={() => navigate('/components')}>View all</Button>
            ) : null}
          >
            {lowStock.length === 0 ? (
              <EmptyState dense icon={AlertTriangle} title="All stocked up" description="No components are below their minimum quantity." />
            ) : (
              <Box>
                {lowStock.slice(0, 4).map((row) => {
                  const isOut = row.quantity === 0;
                  const pct = Math.min(100, Math.round((row.quantity / Math.max(row.minimumQuantity, 1)) * 100));
                  const shortfall = Math.max(row.minimumQuantity - row.quantity, 0);
                  return (
                    <Box key={row.id} sx={rowSx}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 1.25 }}>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: '1.1875rem', fontWeight: 600, mb: 0.5 }} noWrap>{row.componentName}</Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2, rowGap: 0.5 }}>
                            <Tooltip title="Preferred supplier"><Box component="span" sx={metaSx}><Truck size={15} />{row.supplier || 'No supplier on file'}</Box></Tooltip>
                            <Tooltip title="Warehouse location"><Box component="span" sx={metaSx}><MapPin size={15} />{row.location || 'Unassigned'}</Box></Tooltip>
                          </Box>
                        </Box>
                        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                          <Typography sx={{ fontSize: '1.1875rem', fontWeight: 700, color: isOut ? colors.danger : colors.warning }}>
                            {num(row.quantity)} / {num(row.minimumQuantity)}
                          </Typography>
                          <Typography sx={{ fontSize: '0.9375rem', color: colors.textMuted }}>
                            {shortfall > 0 ? `${num(shortfall)} ${row.unit || 'units'} short` : 'at reorder level'}
                          </Typography>
                        </Box>
                        {admin && (
                          <Tooltip title="Raise a purchase order">
                            <Button variant="outlined" size="small" startIcon={<RotateCcw size={16} />} onClick={() => navigate('/purchases')} sx={{ flexShrink: 0, mt: 0.25 }}>
                              Reorder
                            </Button>
                          </Tooltip>
                        )}
                      </Box>
                      <Tooltip title={`On hand is ${pct}% of the reorder level`} placement="bottom-start">
                        <LinearProgress
                          variant="determinate" value={pct}
                          sx={{ height: 7, borderRadius: 999, bgcolor: colors.hover, '& .MuiLinearProgress-bar': { borderRadius: 999, bgcolor: isOut ? colors.danger : colors.warning } }}
                        />
                      </Tooltip>
                    </Box>
                  );
                })}
              </Box>
            )}
          </ChartCard>
        </Grid>
      </Grid>

      {/* Recent activity + projects */}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={7}>
          <ChartCard
            title="Recent Activity"
            subtitle="Latest stock movements"
            action={<Button variant="text" size="small" onClick={() => navigate('/inventory')}>View all</Button>}
          >
            {recentTransactions.length === 0 ? (
              <EmptyState dense icon={Boxes} title="No activity yet" description="Stock in and stock out movements will show here." />
            ) : (
              <Box>
                {recentTransactions.map((row) => {
                  const isIn = row.transactionType === 'STOCK_IN';
                  const time = timeLabel(row.createdAt);
                  return (
                    <Box key={row.id} sx={{ ...rowSx, display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Tooltip title={isIn ? 'Stock received' : 'Stock issued'}>
                        <Box sx={{ width: 48, height: 48, borderRadius: '13px', display: 'grid', placeItems: 'center', bgcolor: isIn ? colors.successSoft : colors.warningSoft, color: isIn ? colors.success : colors.warning, flexShrink: 0 }}>
                          {isIn ? <ArrowDownLeft size={23} /> : <ArrowUpRight size={23} />}
                        </Box>
                      </Tooltip>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '1.1875rem', fontWeight: 600, mb: 0.5 }} noWrap>{row.componentName}</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2, rowGap: 0.5 }}>
                          <Tooltip title="Recorded by"><Box component="span" sx={metaSx}><UserRound size={15} />{row.createdBy || 'system'}</Box></Tooltip>
                          <Box component="span" sx={metaSx}>
                            <CalendarDays size={15} />{dateLabel(row.transactionDate)}{time ? ` · ${time}` : ''}
                          </Box>
                        </Box>
                      </Box>
                      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                        <Typography sx={{ fontSize: '1.3125rem', fontWeight: 700, color: isIn ? colors.success : colors.warning, mb: 0.5 }}>
                          {isIn ? '+' : '−'}{num(row.quantity)}
                        </Typography>
                        <StatusBadge status={isIn ? 'stock_in' : 'stock_out'} />
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </ChartCard>
        </Grid>

        <Grid item xs={12} lg={5}>
          <ChartCard
            title="Projects"
            subtitle="Timeline progress and ownership"
            action={<Button variant="text" size="small" onClick={() => navigate('/projects')}>View all</Button>}
          >
            {projects.length === 0 ? (
              <EmptyState dense icon={FolderKanban} title="No projects yet" description="Active projects will appear here." />
            ) : (
              <Box>
                {projects.slice(0, 5).map((p) => {
                  const pct = completionOf(p);
                  const onHold = pct === null;
                  return (
                    <Box key={p.id} sx={{ ...rowSx, py: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.75 }}>
                        <Typography sx={{ fontSize: '1.1875rem', fontWeight: 600, flexGrow: 1 }} noWrap>{p.projectName}</Typography>
                        <StatusBadge
                          status={p.status === 'ACTIVE' ? 'active' : p.status === 'COMPLETED' ? 'completed' : 'pending'}
                          label={p.status === 'ON_HOLD' ? 'On hold' : undefined}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2, rowGap: 0.5, mb: 1.25 }}>
                        <Tooltip title="Project manager">
                          <Box component="span" sx={metaSx}>
                            <Avatar sx={{ width: 22, height: 22, fontSize: '0.75rem', fontWeight: 700, bgcolor: colors.primarySoft, color: colors.primary }}>
                              {(p.projectManager || '?').charAt(0).toUpperCase()}
                            </Avatar>
                            {p.projectManager || 'Unassigned'}
                          </Box>
                        </Tooltip>
                        <Tooltip title="Target completion date">
                          <Box component="span" sx={metaSx}><CalendarDays size={15} />Due {dateLabel(p.endDate)}</Box>
                        </Tooltip>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Tooltip title={onHold ? 'Paused — no timeline progress' : `${pct}% of the schedule elapsed`} placement="bottom-start" sx={{ flexGrow: 1 }}>
                          <LinearProgress
                            variant="determinate" value={onHold ? 0 : pct}
                            sx={{ flexGrow: 1, height: 10, borderRadius: 999, bgcolor: colors.hover, '& .MuiLinearProgress-bar': { borderRadius: 999, bgcolor: p.status === 'COMPLETED' ? colors.success : colors.primary } }}
                          />
                        </Tooltip>
                        <Typography sx={{ fontSize: '1.0625rem', fontWeight: 700, color: onHold ? colors.textMuted : colors.textPrimary, minWidth: 46, textAlign: 'right' }}>
                          {onHold ? '—' : `${pct}%`}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </ChartCard>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage;
