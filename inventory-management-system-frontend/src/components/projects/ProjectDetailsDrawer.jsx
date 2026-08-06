import { useCallback, useEffect, useState } from 'react';
import {
  Drawer, Box, Typography, IconButton, Divider, LinearProgress, Chip, Avatar,
  Grid, CircularProgress, Button, Tooltip,
} from '@mui/material';
import {
  X, CalendarDays, UserRound, Flag, Wallet, Boxes, Activity,
  Paperclip, Pencil, PackagePlus, Hash,
} from 'lucide-react';
import { getProjectById, getProjectUsageSummary, getProjectUsagesByProject } from '../../api/projectApi';
import { StatusBadge, EmptyState } from '../ui';
import { formatCurrency } from '../../utils/currency';
import { colors } from '../../theme/tokens';

const dateLabel = (d) =>
  (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const statusKey = (s) => {
  switch (s) {
    case 'ACTIVE': return 'active';
    case 'COMPLETED': return 'completed';
    case 'ON_HOLD': return 'pending';
    default: return 'default';
  }
};

const PRIORITY_TONE = {
  CRITICAL: { fg: colors.danger, bg: colors.dangerSoft },
  HIGH: { fg: colors.warning, bg: colors.warningSoft },
  MEDIUM: { fg: colors.primary, bg: colors.primarySoft },
  LOW: { fg: colors.textSecondary, bg: '#F2F1EE' },
};

/**
 * Schedule progress.
 *
 * Derived from status and the date range — the same rule the dashboard uses — so the
 * bar never claims progress the data doesn't support. Returns null for on-hold, which
 * renders as "—" rather than a misleading 0%.
 */
const scheduleProgress = (p) => {
  if (!p) return 0;
  if (p.status === 'COMPLETED') return 100;
  if (p.status === 'ON_HOLD') return null;
  if (p.startDate && p.endDate) {
    const start = new Date(p.startDate).getTime();
    const end = new Date(p.endDate).getTime();
    if (end > start) {
      return Math.max(0, Math.min(100, Math.round(((Date.now() - start) / (end - start)) * 100)));
    }
  }
  return 0;
};

const Field = ({ icon: Icon, label, children, span = 6 }) => (
  <Grid item xs={12} sm={span}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625, mb: 0.375 }}>
      {Icon && <Icon size={12} color={colors.textMuted} />}
      <Typography sx={{ fontSize: '0.6875rem', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
        {label}
      </Typography>
    </Box>
    <Typography component="div" sx={{ fontSize: '0.8125rem', fontWeight: 500, wordBreak: 'break-word' }}>
      {children ?? <Box component="span" sx={{ color: colors.textMuted }}>—</Box>}
    </Typography>
  </Grid>
);

const Section = ({ title, action, children }) => (
  <Box sx={{ mb: 2.5 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.textSecondary }}>
        {title}
      </Typography>
      {action}
    </Box>
    {children}
  </Box>
);

const ProjectDetailsDrawer = ({ projectId, open, onClose, onEdit, onAssignComponent, canWrite }) => {
  const [project, setProject] = useState(null);
  const [usage, setUsage] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      // Usage endpoints are secondary: a failure there must not blank the whole card,
      // so each settles independently and the panel degrades to what did load.
      const [detail, summary, recent] = await Promise.allSettled([
        getProjectById(projectId),
        getProjectUsageSummary(projectId),
        getProjectUsagesByProject(projectId, { page: 0, size: 6, sortBy: 'usageDate', sortDir: 'desc' }),
      ]);

      if (detail.status === 'fulfilled') setProject(detail.value?.data || null);
      else throw detail.reason;

      setUsage(summary.status === 'fulfilled' ? (summary.value?.data?.components || []) : []);
      setActivity(recent.status === 'fulfilled' ? (recent.value?.data?.content || []) : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load this project');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const pct = scheduleProgress(project);
  const onHold = pct === null;
  const priority = PRIORITY_TONE[project?.priority] || PRIORITY_TONE.LOW;
  const team = (project?.teamMembers || '')
    .split(',').map((t) => t.trim()).filter(Boolean);
  const totalUsed = usage.reduce((sum, c) => sum + Number(c.quantityUsed || 0), 0);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 460, md: 520 }, maxWidth: '100%' } } }}
    >
      {/* Header */}
      <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.textMuted, mb: 0.25 }}>
            Project details
          </Typography>
          <Typography sx={{ fontSize: '1.0625rem', fontWeight: 650, letterSpacing: '-0.011em', lineHeight: 1.3 }}>
            {project?.projectName || (loading ? 'Loading…' : '—')}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Close project details">
          <X size={17} />
        </IconButton>
      </Box>

      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 2.5, py: 2.25 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress size={26} /></Box>
        ) : error ? (
          <EmptyState icon={Boxes} title="Could not load project" description={error} dense />
        ) : project ? (
          <>
            {/* Status strip */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mb: 2 }}>
              <StatusBadge status={statusKey(project.status)} label={project.status?.replace('_', ' ')} />
              {project.priority && (
                <Chip
                  size="small" icon={<Flag size={11} />} label={project.priority}
                  sx={{ bgcolor: priority.bg, color: priority.fg, fontWeight: 600, '& .MuiChip-icon': { color: priority.fg } }}
                />
              )}
              <Chip
                size="small" icon={<Hash size={11} />} label={`ID ${project.id}`}
                sx={{ bgcolor: '#F2F1EE', color: colors.textSecondary, fontWeight: 600, '& .MuiChip-icon': { color: colors.textMuted } }}
              />
            </Box>

            {/* Schedule progress */}
            <Section title="Schedule progress">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Tooltip title={onHold ? 'Paused — no timeline progress' : `${pct}% of the schedule has elapsed`}>
                  <LinearProgress
                    variant="determinate" value={onHold ? 0 : pct}
                    sx={{
                      flexGrow: 1, height: 7, borderRadius: 999, bgcolor: colors.hover,
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 999,
                        bgcolor: project.status === 'COMPLETED' ? colors.success : colors.primary,
                      },
                    }}
                  />
                </Tooltip>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, minWidth: 38, textAlign: 'right', color: onHold ? colors.textMuted : colors.textPrimary }}>
                  {onHold ? '—' : `${pct}%`}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.6875rem', color: colors.textMuted, mt: 0.5 }}>
                Derived from the start and end dates — not a manual completion figure.
              </Typography>
            </Section>

            <Divider sx={{ mb: 2.5 }} />

            <Section title="Overview">
              <Grid container spacing={2}>
                <Field icon={UserRound} label="Project manager">{project.projectManager}</Field>
                <Field icon={Wallet} label="Budget">
                  {project.budget != null ? formatCurrency(project.budget) : null}
                </Field>
                <Field icon={CalendarDays} label="Start date">{dateLabel(project.startDate)}</Field>
                <Field icon={CalendarDays} label="End date">{dateLabel(project.endDate)}</Field>
                <Field label="Description" span={12}>{project.description}</Field>
              </Grid>
            </Section>

            <Section title={`Team${team.length ? ` · ${team.length}` : ''}`}>
              {team.length === 0 ? (
                <Typography sx={{ fontSize: '0.8125rem', color: colors.textMuted }}>No team members recorded.</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {team.map((name) => (
                    <Chip
                      key={name} size="small"
                      avatar={<Avatar sx={{ bgcolor: colors.primarySoft, color: colors.primary, fontSize: '0.5625rem', fontWeight: 700 }}>{name.charAt(0).toUpperCase()}</Avatar>}
                      label={name}
                      sx={{ bgcolor: '#F5F4F1', color: colors.textPrimary, fontWeight: 500 }}
                    />
                  ))}
                </Box>
              )}
            </Section>

            <Divider sx={{ mb: 2.5 }} />

            <Section
              title={`Components assigned${usage.length ? ` · ${usage.length}` : ''}`}
              action={canWrite && (
                <Button size="small" startIcon={<PackagePlus size={14} />} onClick={() => onAssignComponent?.(project)}>
                  Assign
                </Button>
              )}
            >
              {usage.length === 0 ? (
                <Typography sx={{ fontSize: '0.8125rem', color: colors.textMuted }}>
                  No components have been consumed by this project yet.
                </Typography>
              ) : (
                <Box>
                  {usage.map((c) => (
                    <Box
                      key={c.componentName}
                      sx={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
                        py: 0.875, borderBottom: `1px solid ${colors.border}`, '&:last-of-type': { borderBottom: 0 },
                      }}
                    >
                      <Typography sx={{ fontSize: '0.8125rem', minWidth: 0 }} noWrap>{c.componentName}</Typography>
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                        {Number(c.quantityUsed || 0).toLocaleString()}
                      </Typography>
                    </Box>
                  ))}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1.25, mt: 0.5, borderTop: `1px solid ${colors.border}` }}>
                    <Typography sx={{ fontSize: '0.75rem', color: colors.textSecondary, fontWeight: 600 }}>Total consumed</Typography>
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {totalUsed.toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Section>

            <Section title="Recent activity">
              {activity.length === 0 ? (
                <Typography sx={{ fontSize: '0.8125rem', color: colors.textMuted }}>No usage recorded yet.</Typography>
              ) : (
                <Box>
                  {activity.map((a) => (
                    <Box key={a.id} sx={{ display: 'flex', gap: 1.25, py: 0.875 }}>
                      <Box sx={{ width: 26, height: 26, borderRadius: '7px', display: 'grid', placeItems: 'center', bgcolor: colors.primarySoft, color: colors.primary, flexShrink: 0 }}>
                        <Activity size={13} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.8125rem' }}>
                          <strong>{Number(a.quantityUsed || 0).toLocaleString()}</strong> × {a.componentName}
                        </Typography>
                        <Typography sx={{ fontSize: '0.6875rem', color: colors.textMuted }}>
                          {dateLabel(a.usageDate)}{a.remarks ? ` · ${a.remarks}` : ''}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Section>

            <Section title="Attachments">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: colors.textMuted }}>
                <Paperclip size={13} />
                <Typography sx={{ fontSize: '0.75rem' }}>
                  Per-project documents aren&apos;t stored yet — invoices live in the Purchases module.
                </Typography>
              </Box>
            </Section>

            <Typography sx={{ fontSize: '0.6875rem', color: colors.textMuted, mt: 1 }}>
              Created {dateLabel(project.createdAt)} · Updated {dateLabel(project.updatedAt)}
            </Typography>
          </>
        ) : null}
      </Box>

      {canWrite && project && !loading && (
        <Box sx={{ px: 2.5, py: 1.75, borderTop: `1px solid ${colors.border}`, display: 'flex', gap: 1 }}>
          <Button fullWidth variant="outlined" startIcon={<Pencil size={15} />} onClick={() => onEdit?.(project)}>
            Edit project
          </Button>
        </Box>
      )}
    </Drawer>
  );
};

export default ProjectDetailsDrawer;
