import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Grid, Alert, Button, Typography, LinearProgress, Tooltip, Avatar, CircularProgress, Skeleton } from '@mui/material';
import {
  CircuitBoard, DollarSign, AlertTriangle, FolderKanban, ChevronRight, Layers, PackagePlus,
  ArrowDownLeft, ArrowUpRight, Download, Boxes, RotateCcw, MapPin, Truck, Clock, UserRound,
} from 'lucide-react';
import { getDashboardSummary, getLowStock, getRecentTransactions } from '../api/dashboardApi';
import { getProjects } from '../api/projectApi';
import { getComponents } from '../api/componentApi';
import { getComponentCategories } from '../api/componentCategoryApi';
import { useAuth } from '../auth/AuthContext';
import { isAdmin } from '../utils/roleUtils';
import { displayName } from '../utils/displayName';
import { MetricCard, ChartCard, StatusBadge, EmptyState } from '../components/ui';
import { colors } from '../theme/tokens';

import { formatCurrency as currency } from '../utils/currency';

const num = (n) => Number(n || 0).toLocaleString();

const dateLabel = (d) => (d ? new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const timeLabel = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '');

// Calendar-day key in local time, so "today" means the viewer's today, not UTC's.
const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
};

/** "Today", "Yesterday", or "Sat, Oct 3" — the heading a group of activity sits under. */
const dayHeading = (d) => {
  if (!d) return 'Earlier';
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (dayKey(d) === dayKey(now)) return 'Today';
  if (dayKey(d) === dayKey(yesterday)) return 'Yesterday';
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

/** "3 days ago" for anything recent, a date beyond a fortnight. */
const ago = (iso) => {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days} days ago`;
  return dateLabel(iso);
};

// "View all" that never wraps onto two lines, however narrow the card header gets.
const ViewAll = ({ onClick }) => (
  <Button variant="text" size="small" onClick={onClick} endIcon={<ChevronRight size={15} />}
    sx={{ whiteSpace: 'nowrap', flexShrink: 0, '& .MuiButton-endIcon': { ml: 0.25 } }}>
    View all
  </Button>
);

// Placeholder rows while a panel loads, instead of flashing "No activity yet" first.
const PanelSkeleton = ({ rows = 4 }) => (
  <Box>
    {Array.from({ length: rows }).map((_, i) => (
      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25 }}>
        <Skeleton variant="rounded" width={34} height={34} sx={{ borderRadius: '9px', flexShrink: 0 }} />
        <Box sx={{ flexGrow: 1 }}>
          <Skeleton variant="text" width="62%" height={18} />
          <Skeleton variant="text" width="38%" height={14} />
        </Box>
        <Skeleton variant="text" width={36} height={18} />
      </Box>
    ))}
  </Box>
);

// Small heading that separates groups inside a panel ("Today", "Yesterday").
const groupLabelSx = {
  display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, mb: 0.25,
  fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: colors.textMuted,
  '&::after': { content: '""', flexGrow: 1, height: '1px', bgcolor: colors.border },
};

// How many categories the Stock by Category panel lists before "+ N more".
const TOP_CATEGORIES = 8;

// KPI figures step down on a phone, where the cards sit two to a row.
const metricValueSize = { xs: '1.3rem', sm: '1.75rem' };

// Row treatment shared by every list section — consistent spacing + hover.
const rowSx = {
  py: 1.25, px: 1.25, mx: -1.25, borderRadius: 1.5,
  transition: 'background-color .18s ease',
  '&:hover': { bgcolor: colors.hover },
};

const metaSx = { display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: '0.75rem', color: colors.textMuted };

// RFC 4180 quoting so names containing commas, quotes or newlines survive Excel.
const csvCell = (value) => {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const downloadCsv = (filename, rows) => {
  // BOM so Excel reads the file as UTF-8 (₹ and accented names stay intact).
  const blob = new Blob(['﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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

// ---- Bright, light-filled look for this page ---------------------------------------
// Panels read as frosted glass lifted off a softly lit backdrop: near-white, a hairline
// white rim, and a faint cool glow underneath instead of a grey drop shadow.
const brightPanelSx = {
  background: 'linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.88) 100%)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255,255,255,0.95)',
  boxShadow: '0 1px 0 rgba(255,255,255,1) inset, 0 0 0 1px rgba(34,73,127,0.06), 0 16px 40px -22px rgba(44,92,158,0.35)',
  transition: 'box-shadow .25s ease',
  '&:hover': {
    boxShadow: '0 1px 0 rgba(255,255,255,1) inset, 0 0 0 1px rgba(34,73,127,0.08), 0 22px 48px -22px rgba(44,92,158,0.45)',
  },
};

// Soft pools of light behind the content — sky blue top-left, warm sun top-right,
// mint lower down — so the page itself glows rather than sitting on flat beige.
const lightBackdropSx = {
  position: 'relative',
  isolation: 'isolate',
  '&::before': {
    content: '""', position: 'absolute', zIndex: -1, pointerEvents: 'none',
    inset: { xs: '-16px', md: '-24px' },
    borderRadius: 4,
    background: [
      'radial-gradient(900px 420px at 0% 0%, rgba(147,197,253,0.38), transparent 60%)',
      'radial-gradient(700px 380px at 100% 0%, rgba(253,224,171,0.45), transparent 60%)',
      'radial-gradient(800px 420px at 55% 85%, rgba(167,243,208,0.30), transparent 65%)',
      'linear-gradient(180deg, #FFFFFF 0%, #FAFBFD 100%)',
    ].join(', '),
  },
};

// A glowing fill for progress bars, in the bar's own colour.
const glowBar = (color) => ({
  borderRadius: 999,
  bgcolor: color,
  backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 60%)',
  boxShadow: `0 0 10px ${color}66`,
});

const DashboardPage = () => {
  const { role, email, username } = useAuth();
  const navigate = useNavigate();
  const admin = isAdmin(role);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recentParts, setRecentParts] = useState([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        // The two panels added later are best-effort: if either call fails, the rest
        // of the dashboard still loads and that panel shows its empty state.
        const [s, ls, ts, proj, cats, parts] = await Promise.all([
          getDashboardSummary(),
          getLowStock(),
          getRecentTransactions(6),
          getProjects({ page: 0, size: 6, sortBy: 'startDate', sortDir: 'desc' }),
          getComponentCategories().catch(() => null),
          getComponents({ page: 0, size: 5, sortBy: 'createdAt', sortDir: 'desc' }).catch(() => null),
        ]);
        setSummary(s);
        setLowStock(ls || []);
        setRecentTransactions(ts || []);
        setProjects(proj?.data?.content || []);
        setCategories(cats?.data || []);
        setRecentParts(parts?.data?.content || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Snapshot of current stock levels, straight from the components catalogue.
  const handleExport = async () => {
    setExporting(true);
    setError('');
    try {
      const res = await getComponents({ page: 0, size: 1000, sortBy: 'componentName', sortDir: 'asc' });
      const items = res.data?.content || [];
      const rows = [
        ['Item Code', 'Component', 'Category', 'Quantity', 'Minimum Qty', 'Unit Price', 'Stock Value', 'Location', 'Stock Level', 'Status'],
        ...items.map((c) => [
          c.itemCode || '',
          c.componentName || '',
          c.category || '',
          c.quantity ?? 0,
          c.minimumQuantity ?? 0,
          c.unitPrice ?? '',
          c.stockValue ?? '',
          c.location || '',
          c.quantity === 0 ? 'Out of stock' : c.quantity <= c.minimumQuantity ? 'Low stock' : 'In stock',
          c.quantity > 0 && c.status === 'ACTIVE' ? 'Available' : 'Not Available',
        ]),
      ];
      downloadCsv(`stock-levels-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not export stock levels');
    } finally {
      setExporting(false);
    }
  };

  const totalComponents = summary?.totalComponents || 0;
  const low = summary?.lowStockComponents || 0;
  const out = summary?.outOfStockComponents || 0;
  const healthy = Math.max(totalComponents - low - out, 0);
  const unpriced = summary?.componentsWithoutPrice || 0;
  // Stock status, kept as a compact strip above the category breakdown.
  const stockStatus = [
    { name: 'In stock', value: healthy, color: colors.success },
    { name: 'Low', value: low, color: colors.warning },
    { name: 'Out', value: out, color: colors.danger },
  ];

  // Categories ranked by how many parts they hold; empty ones are left off the chart.
  const rankedCategories = useMemo(
    () => categories
      .filter((c) => Number(c.componentCount) > 0)
      .sort((a, b) => Number(b.componentCount) - Number(a.componentCount) || a.name.localeCompare(b.name)),
    [categories]
  );
  const topCategories = rankedCategories.slice(0, TOP_CATEGORIES);
  const moreCategories = rankedCategories.length - topCategories.length;
  const largestCategory = Number(topCategories[0]?.componentCount) || 1;
  const partsInCategories = rankedCategories.reduce((s, c) => s + Number(c.componentCount), 0);

  // One line under the alerts instead of "No supplier on file · Unassigned" on every row.
  // Rows are shorter without that line, so the panel has room for six rather than four.
  const shownLowStock = lowStock.slice(0, 6);
  const lowStockGapNote = useMemo(() => {
    const n = shownLowStock.length;
    if (!n) return '';
    const noSupplier = shownLowStock.filter((r) => !r.supplier).length;
    const noLocation = shownLowStock.filter((r) => !r.location).length;
    if (noSupplier === n && noLocation === n) {
      return n === 1
        ? 'This part has no supplier or storage location on file.'
        : `None of these ${n} has a supplier or a storage location on file.`;
    }
    const bits = [];
    if (noSupplier) bits.push(`${noSupplier} of ${n} ${noSupplier === 1 ? 'has' : 'have'} no supplier`);
    if (noLocation) bits.push(`${noLocation} of ${n} ${noLocation === 1 ? 'has' : 'have'} no storage location`);
    return bits.length ? `${bits.join(' · ')} on file.` : '';
  }, [shownLowStock]);

  // Recent activity grouped under Today / Yesterday / a date, newest first.
  const activityGroups = useMemo(() => {
    const groups = [];
    recentTransactions.forEach((row) => {
      const when = row.createdAt || row.transactionDate;
      const heading = dayHeading(when);
      const last = groups[groups.length - 1];
      if (last && last.heading === heading) last.rows.push(row);
      else groups.push({ heading, rows: [row] });
    });
    return groups;
  }, [recentTransactions]);

  const metrics = [
    {
      title: 'Total Stock Value',
      value: currency(summary?.totalInventoryValue),
      icon: DollarSign,
      tone: 'success',
      // An unpriced component contributes nothing, so say so rather than let the
      // figure quietly understate the inventory.
      caption: unpriced > 0
        ? `${num(unpriced)} component${unpriced === 1 ? '' : 's'} without a unit price`
        : 'Every component is priced',
      tip: 'On-hand quantity × the unit price set on each component',
    },
    { title: 'Total Components', value: num(totalComponents), icon: CircuitBoard, tone: 'info', caption: `${num(healthy)} within healthy levels`, tip: 'Active components in the catalogue' },
    { title: 'Low Stock Items', value: num(low), icon: AlertTriangle, tone: 'warning', caption: 'At or below reorder point', tip: 'Quantity is at or below the minimum level' },
    { title: 'Active Projects', value: num(summary?.activeProjects), icon: FolderKanban, tone: 'purple', caption: 'Currently in progress', tip: 'Projects with status ACTIVE' },
  ];

  const firstName = displayName(username, email);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const attention = low + out;
  const statusLine = attention === 0
    ? 'All components are within healthy stock levels.'
    : `${low} low-stock and ${out} out-of-stock item${attention === 1 ? '' : 's'} need attention.`;

  return (
    <Box sx={lightBackdropSx}>
      {/* Header */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, mb: 2.5 }}>
        <Box>
          <Typography variant="h1" sx={{ fontSize: { xs: '1.5rem', md: '1.75rem' }, mb: 0.5 }}>
            {greeting}, {firstName}
          </Typography>
          <Typography sx={{ fontSize: '0.875rem', color: colors.textSecondary }}>
            {/* The top bar shows the date from the lg breakpoint up; below it the top
                bar hides it, so this is the one place the date appears there. */}
            <Box component="span" sx={{ display: { xs: 'inline', lg: 'none' } }}>{today} · </Box>
            {statusLine}
          </Typography>
        </Box>
        {admin && (
          <Box sx={{ display: 'flex', gap: 1.75 }}>
            <Tooltip title="Download a CSV snapshot of current stock levels">
              <span>
                <Button
                  variant="outlined"
                  startIcon={exporting ? <CircularProgress size={17} color="inherit" /> : <Download size={16} />}
                  onClick={handleExport}
                  disabled={exporting}
                >
                  {exporting ? 'Exporting…' : 'Export'}
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Record a stock in or stock out movement">
              <Button
                variant="contained" startIcon={<Boxes size={16} />} onClick={() => navigate('/inventory')}
                sx={{
                  backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0))',
                  boxShadow: '0 8px 22px -8px rgba(34,73,127,0.65), 0 0 0 1px rgba(255,255,255,0.12) inset',
                  '&:hover': { boxShadow: '0 12px 28px -8px rgba(34,73,127,0.75), 0 0 0 1px rgba(255,255,255,0.16) inset' },
                }}
              >
                Record Movement
              </Button>
            </Tooltip>
          </Box>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* KPIs */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {(loading ? Array.from({ length: 4 }) : metrics).map((m, i) => (
          // Two per row on a phone, so all four are visible at once without scrolling.
          <Grid item xs={6} lg={3} key={m?.title || i}>
            {m?.tip ? (
              <Tooltip title={m.tip} placement="top" arrow>
                <Box sx={{ height: '100%' }}>
                  <MetricCard loading={loading} icon={m.icon} title={m.title} value={m.value} caption={m.caption} tone={m.tone} glow valueSize={metricValueSize} />
                </Box>
              </Tooltip>
            ) : (
              <MetricCard loading={loading} icon={m?.icon} title={m?.title} value={m?.value} caption={m?.caption} tone={m?.tone} glow valueSize={metricValueSize} />
            )}
          </Grid>
        ))}
      </Grid>

      {/* Stock by category + low stock alerts */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} lg={5}>
          <ChartCard
            sx={brightPanelSx}
            title="Stock by Category"
            subtitle={rankedCategories.length
              ? `${num(partsInCategories)} parts across ${rankedCategories.length} categories`
              : 'Parts in each category'}
            action={<ViewAll onClick={() => navigate('/component-categories')} />}
          >
            {/* Stock status, compact: the donut it replaces was one colour at 98%. */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {stockStatus.map((d) => (
                <Tooltip key={d.name} title={`${num(d.value)} component${d.value === 1 ? '' : 's'} ${d.name === 'In stock' ? 'above their reorder point' : d.name === 'Low' ? 'at or below their reorder point' : 'with no stock'}`}>
                  <Box sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.5, borderRadius: 999,
                    bgcolor: `${d.color}14`, border: `1px solid ${d.color}2E`,
                  }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: d.color, boxShadow: `0 0 6px ${d.color}` }} />
                    <Typography sx={{ fontSize: '0.75rem', color: colors.textSecondary }}>{d.name}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{num(d.value)}</Typography>
                  </Box>
                </Tooltip>
              ))}
            </Box>

            {loading ? (
              <PanelSkeleton rows={5} />
            ) : topCategories.length === 0 ? (
              <EmptyState dense icon={Layers} title="No categories yet" description="Parts will be counted here once they are filed into categories." />
            ) : (
              <Box>
                {topCategories.map((c, i) => {
                  const count = Number(c.componentCount);
                  const width = Math.max(4, Math.round((count / largestCategory) * 100));
                  return (
                    <Tooltip key={c.id} title={`Open categories — ${c.name}`} placement="top-start">
                      <Box
                        role="button" tabIndex={0}
                        onClick={() => navigate('/component-categories')}
                        onKeyDown={(e) => { if (e.key === 'Enter') navigate('/component-categories'); }}
                        sx={{ ...rowSx, py: 0.875, cursor: 'pointer' }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
                          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, flexGrow: 1 }} noWrap>{c.name}</Typography>
                          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{num(count)}</Typography>
                        </Box>
                        <Box sx={{ height: 7, borderRadius: 999, bgcolor: colors.hover, overflow: 'hidden' }}>
                          <Box sx={{
                            height: '100%', width: `${width}%`, ...glowBar(colors.primary),
                            // Bars grow in one after another as the panel appears.
                            transformOrigin: 'left center',
                            animation: 'svBarGrow .7s cubic-bezier(.4,0,.2,1) both',
                            animationDelay: `${120 + i * 60}ms`,
                            '@keyframes svBarGrow': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
                            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                          }} />
                        </Box>
                      </Box>
                    </Tooltip>
                  );
                })}
                {moreCategories > 0 && (
                  <Button variant="text" size="small" onClick={() => navigate('/component-categories')} sx={{ mt: 0.75, ml: -0.75 }}>
                    + {moreCategories} more categor{moreCategories === 1 ? 'y' : 'ies'}
                  </Button>
                )}
              </Box>
            )}
          </ChartCard>
        </Grid>

        <Grid item xs={12} lg={7}>
          <ChartCard
            sx={brightPanelSx}
            title="Low Stock Alerts"
            subtitle="Components at or below their reorder point"
            action={admin && lowStock.length > 0 ? <ViewAll onClick={() => navigate('/components')} /> : null}
          >
            {loading ? (
              <PanelSkeleton rows={4} />
            ) : lowStock.length === 0 ? (
              <EmptyState dense icon={AlertTriangle} title="All stocked up" description="No components are below their minimum quantity." />
            ) : (
              <Box>
                {shownLowStock.map((row) => {
                  const isOut = row.quantity === 0;
                  const pct = Math.min(100, Math.round((row.quantity / Math.max(row.minimumQuantity, 1)) * 100));
                  const shortfall = Math.max(row.minimumQuantity - row.quantity, 0);
                  const hasMeta = row.supplier || row.location;
                  return (
                    <Box key={row.id} sx={rowSx}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }} noWrap>{row.componentName}</Typography>
                          {/* Only what is actually on file — the gaps are summarised once below. */}
                          {hasMeta && (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2, rowGap: 0.5, mt: 0.25 }}>
                              {row.supplier && <Tooltip title="Preferred supplier"><Box component="span" sx={metaSx}><Truck size={13} />{row.supplier}</Box></Tooltip>}
                              {row.location && <Tooltip title="Warehouse location"><Box component="span" sx={metaSx}><MapPin size={13} />{row.location}</Box></Tooltip>}
                            </Box>
                          )}
                        </Box>
                        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: isOut ? colors.danger : colors.warning, fontVariantNumeric: 'tabular-nums' }}>
                            {num(row.quantity)} / {num(row.minimumQuantity)}
                          </Typography>
                          <Typography sx={{ fontSize: '0.6875rem', color: colors.textMuted }}>
                            {shortfall > 0 ? `${num(shortfall)} short` : 'at reorder level'}
                          </Typography>
                        </Box>
                        {admin && (
                          <Tooltip title="Raise a purchase order">
                            <Button variant="outlined" size="small" startIcon={<RotateCcw size={16} />} onClick={() => navigate('/purchases')} sx={{ flexShrink: 0 }}>
                              Reorder
                            </Button>
                          </Tooltip>
                        )}
                      </Box>
                      <Tooltip title={`On hand is ${pct}% of the reorder level`} placement="bottom-start">
                        <LinearProgress
                          variant="determinate" value={pct}
                          sx={{ height: 7, borderRadius: 999, bgcolor: colors.hover, '& .MuiLinearProgress-bar': glowBar(isOut ? colors.danger : colors.warning) }}
                        />
                      </Tooltip>
                    </Box>
                  );
                })}
                {lowStockGapNote && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.25, pt: 1.25, borderTop: `1px dashed ${colors.border}` }}>
                    <Truck size={14} color={colors.textMuted} style={{ flexShrink: 0 }} />
                    <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted }}>{lowStockGapNote}</Typography>
                  </Box>
                )}
              </Box>
            )}
          </ChartCard>
        </Grid>
      </Grid>

      {/* Recent activity + (projects, recently added) */}
      <Grid container spacing={2}>
        <Grid item xs={12} lg={7}>
          <ChartCard
            sx={brightPanelSx}
            title="Recent Activity"
            subtitle="Latest stock movements"
            action={<ViewAll onClick={() => navigate('/inventory')} />}
          >
            {loading ? (
              <PanelSkeleton rows={6} />
            ) : recentTransactions.length === 0 ? (
              <EmptyState dense icon={Boxes} title="No activity yet" description="Stock in and stock out movements will show here." />
            ) : (
              <Box>
                {activityGroups.map((group, gi) => (
                  <Box key={`${group.heading}-${gi}`}>
                    <Typography component="div" sx={{ ...groupLabelSx, mt: gi === 0 ? 0 : 1.75 }}>{group.heading}</Typography>
                    {group.rows.map((row) => {
                      const isIn = row.transactionType === 'STOCK_IN';
                      const time = timeLabel(row.createdAt);
                      const who = row.createdBy ? displayName(row.createdByName, row.createdBy) : 'System';
                      return (
                        <Box key={row.id} sx={{ ...rowSx, display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Tooltip title={isIn ? 'Stock received' : 'Stock issued'}>
                            <Box sx={{ width: 34, height: 34, borderRadius: '9px', display: 'grid', placeItems: 'center', bgcolor: isIn ? colors.successSoft : colors.warningSoft, color: isIn ? colors.success : colors.warning, flexShrink: 0 }}>
                              {isIn ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                            </Box>
                          </Tooltip>
                          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, mb: 0.25 }} noWrap>{row.componentName}</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2, rowGap: 0.5 }}>
                              <Tooltip title={row.createdBy || 'Recorded by the system'}>
                                <Box component="span" sx={metaSx}><UserRound size={13} />{who}</Box>
                              </Tooltip>
                              {time && <Box component="span" sx={metaSx}><Clock size={13} />{time}</Box>}
                            </Box>
                          </Box>
                          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: isIn ? colors.success : colors.warning, mb: 0.25, fontVariantNumeric: 'tabular-nums' }}>
                              {isIn ? '+' : '−'}{num(row.quantity)}
                            </Typography>
                            <StatusBadge status={isIn ? 'stock_in' : 'stock_out'} />
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                ))}
              </Box>
            )}
          </ChartCard>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
            {/* Projects, one line each: a whole panel for one project left it mostly empty. */}
            <ChartCard
              sx={{ ...brightPanelSx, height: 'auto', flexShrink: 0 }}
              title="Projects"
              subtitle={projects.length ? `${projects.length} project${projects.length === 1 ? '' : 's'}` : undefined}
              action={<ViewAll onClick={() => navigate('/projects')} />}
            >
              {loading ? (
                <PanelSkeleton rows={1} />
              ) : projects.length === 0 ? (
                <Typography sx={{ fontSize: '0.8125rem', color: colors.textMuted }}>No projects yet.</Typography>
              ) : (
                <Box>
                  {projects.slice(0, 3).map((p) => {
                    const pct = completionOf(p);
                    const onHold = pct === null;
                    return (
                      <Box key={p.id} sx={{ ...rowSx, py: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Tooltip title={`Project manager: ${p.projectManager || 'Unassigned'}`}>
                          <Avatar sx={{ width: 26, height: 26, fontSize: '0.6875rem', fontWeight: 700, bgcolor: colors.primarySoft, color: colors.primary, flexShrink: 0 }}>
                            {(p.projectManager || '?').charAt(0).toUpperCase()}
                          </Avatar>
                        </Tooltip>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }} noWrap>{p.projectName}</Typography>
                          <Typography sx={{ fontSize: '0.6875rem', color: colors.textMuted }} noWrap>
                            {p.projectManager || 'Unassigned'}{p.endDate ? ` · due ${dateLabel(p.endDate)}` : ''}
                          </Typography>
                        </Box>
                        <Tooltip title={onHold ? 'Paused — no timeline progress' : `${pct}% of the schedule elapsed`}>
                          <Box sx={{ width: 64, flexShrink: 0, display: { xs: 'none', sm: 'block' } }}>
                            <LinearProgress
                              variant="determinate" value={onHold ? 0 : pct}
                              sx={{ height: 6, borderRadius: 999, bgcolor: colors.hover, '& .MuiLinearProgress-bar': glowBar(p.status === 'COMPLETED' ? colors.success : colors.primary) }}
                            />
                          </Box>
                        </Tooltip>
                        <StatusBadge
                          status={p.status === 'ACTIVE' ? 'active' : p.status === 'COMPLETED' ? 'completed' : 'pending'}
                          label={p.status === 'ON_HOLD' ? 'On hold' : undefined}
                        />
                      </Box>
                    );
                  })}
                </Box>
              )}
            </ChartCard>

            {/* Something live in the space the projects panel used to fill. */}
            <ChartCard
              sx={{ ...brightPanelSx, flexGrow: 1 }}
              title="Recently Added"
              subtitle="Newest parts in the catalogue"
              action={<ViewAll onClick={() => navigate('/components')} />}
            >
              {loading ? (
                <PanelSkeleton rows={5} />
              ) : recentParts.length === 0 ? (
                <EmptyState dense icon={PackagePlus} title="Nothing added yet" description="New parts will appear here as they are created." />
              ) : (
                <Box>
                  {recentParts.map((c) => {
                    const path = [c.category, c.type, c.value].filter(Boolean).join(' › ');
                    return (
                      <Box
                        key={c.id} role="button" tabIndex={0}
                        onClick={() => navigate(`/components?q=${encodeURIComponent(c.componentName || '')}`)}
                        onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/components?q=${encodeURIComponent(c.componentName || '')}`); }}
                        sx={{ ...rowSx, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}
                      >
                        <Box sx={{ width: 34, height: 34, borderRadius: '9px', display: 'grid', placeItems: 'center', bgcolor: colors.primarySoft, color: colors.primary, flexShrink: 0 }}>
                          <PackagePlus size={16} />
                        </Box>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, mb: 0.25 }} noWrap>{c.componentName}</Typography>
                          <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted }} noWrap>{path || 'Not categorised yet'}</Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            {num(c.quantity)} <Box component="span" sx={{ fontWeight: 500, color: colors.textMuted }}>{c.unit || 'pcs'}</Box>
                          </Typography>
                          <Typography sx={{ fontSize: '0.6875rem', color: colors.textMuted }}>{ago(c.createdAt)}</Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </ChartCard>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage;
