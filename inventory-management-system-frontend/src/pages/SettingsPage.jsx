import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Card, Tabs, Tab, Grid, TextField, MenuItem, Switch, FormControlLabel,
  Button, Typography, Divider, Snackbar, Alert, CircularProgress, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Tooltip, Chip,
} from '@mui/material';
import {
  Settings as SettingsIcon, Building2, SlidersHorizontal, Boxes, Bell, Palette,
  DatabaseBackup, Users, Save, Plus, Trash2, Download, Upload, ShieldCheck,
  Pencil, KeyRound, UserX, UserCheck, Crown,
} from 'lucide-react';
import { getSettings, updateSettings } from '../api/settingsApi';
import {
  getUsers, createUser, updateUser, setUserActive, resetUserPassword, deleteUser,
} from '../api/userApi';
import { useAuth } from '../auth/AuthContext';
import { canManageUsers, roleLabel } from '../utils/roleUtils';
import DataTable from '../components/common/DataTable';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { PageHeader, StatusBadge } from '../components/ui';
import { colors } from '../theme/tokens';

const CATEGORY_META = {
  COMPANY: { label: 'Company', icon: Building2, desc: 'Organisation details shown across the system.' },
  PREFERENCES: { label: 'Preferences', icon: SlidersHorizontal, desc: 'Regional and display preferences.' },
  INVENTORY: { label: 'Inventory', icon: Boxes, desc: 'Stock, currency and item-code behaviour.' },
  NOTIFICATIONS: { label: 'Notifications', icon: Bell, desc: 'Choose which alerts are generated.' },
  APPEARANCE: { label: 'Appearance', icon: Palette, desc: 'Theme and interface density.' },
  BACKUP: { label: 'Backup', icon: DatabaseBackup, desc: 'Data backup configuration.' },
};
// Tab order; "USERS" is a synthetic tab handled separately.
const TAB_ORDER = ['COMPANY', 'USERS', 'PREFERENCES', 'INVENTORY', 'NOTIFICATIONS', 'APPEARANCE', 'BACKUP'];

const SELECT_OPTIONS = {
  'appearance.theme': ['light', 'dark'],
  'appearance.density': ['comfortable', 'compact'],
  'backup.frequency': ['daily', 'weekly', 'monthly'],
  'inventory.currency': ['INR', 'USD', 'EUR', 'GBP'],
  'preferences.language': ['English', 'Hindi'],
};

// Categories whose values are stored but not yet read by the interface. Saying so
// beats letting someone pick "dark" and wonder why nothing changed.
const NOT_APPLIED_NOTE = {
  APPEARANCE: 'Saved for future use — the interface currently renders in the light theme at comfortable density regardless of these values.',
  PREFERENCES: 'Date format, timezone and language are stored here for upcoming releases; the interface currently uses the system defaults.',
};

// ---- Users & Roles manager (master admin only) -----------------------------
const emptyUserForm = { username: '', email: '', password: '', role: 'USER' };

const UsersManager = ({ notify }) => {
  const { email: myEmail } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [form, setForm] = useState(emptyUserForm);
  const [saving, setSaving] = useState(false);
  const [deleteRow, setDeleteRow] = useState(null);
  const [pwdRow, setPwdRow] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const isSelf = (r) => r.email?.toLowerCase() === myEmail?.toLowerCase();

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await getUsers(); setUsers(res.data || []); }
    catch (err) { notify(err.response?.data?.message || 'Failed to load users', 'error'); }
    finally { setLoading(false); }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditRow(null); setForm(emptyUserForm); setDialogOpen(true); };
  const openEdit = (r) => {
    setEditRow(r);
    setForm({ username: r.username || '', email: r.email || '', password: '', role: r.role });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.username.trim() || !form.email.trim()) {
      notify('Name and email are required', 'error'); return;
    }
    if (!editRow && !form.password) { notify('Password is required', 'error'); return; }
    setSaving(true);
    try {
      if (editRow) {
        await updateUser(editRow.id, { username: form.username, email: form.email, role: form.role });
        notify('Account updated', 'success');
      } else {
        await createUser(form);
        notify('Account created', 'success');
      }
      setDialogOpen(false);
      load();
    } catch (err) { notify(err.response?.data?.message || 'Save failed', 'error'); }
    finally { setSaving(false); }
  };

  const handleToggleActive = async (r) => {
    try {
      await setUserActive(r.id, !r.active);
      notify(r.active ? 'Account deactivated' : 'Account activated', 'success');
      load();
    } catch (err) { notify(err.response?.data?.message || 'Failed to update account', 'error'); }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) { notify('Password must be at least 6 characters', 'error'); return; }
    setSaving(true);
    try {
      await resetUserPassword(pwdRow.id, newPassword);
      notify(`Password reset for ${pwdRow.email}`, 'success');
      setPwdRow(null); setNewPassword('');
    } catch (err) { notify(err.response?.data?.message || 'Failed to reset password', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await deleteUser(deleteRow.id);
      notify('Account deleted', 'success');
      setDeleteRow(null);
      load();
    } catch (err) { notify(err.response?.data?.message || 'Delete failed', 'error'); }
  };

  const columns = [
    {
      field: 'username', headerName: 'Name',
      render: (r) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>{r.username}</Typography>
          {isSelf(r) && <Chip size="small" label="You" sx={{ bgcolor: colors.primarySoft, color: colors.primary }} />}
        </Box>
      ),
    },
    { field: 'email', headerName: 'Email' },
    {
      field: 'role', headerName: 'Role',
      render: (r) => (
        <Chip
          size="small"
          icon={r.masterAdmin ? <Crown size={12} /> : undefined}
          label={roleLabel(r.role)}
          sx={{
            fontWeight: 600,
            bgcolor: r.masterAdmin ? colors.warningSoft : r.role === 'ADMIN' ? colors.primarySoft : '#F2F1EE',
            color: r.masterAdmin ? colors.warning : r.role === 'ADMIN' ? colors.primary : colors.textSecondary,
            '& .MuiChip-icon': { color: colors.warning },
          }}
        />
      ),
    },
    {
      field: 'active', headerName: 'Status',
      render: (r) => <StatusBadge status={r.active ? 'active' : 'cancelled'} label={r.active ? 'Active' : 'Inactive'} />,
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 650 }}>Users &amp; Roles</Typography>
          <Typography sx={{ color: colors.textMuted, fontSize: '0.8125rem' }}>
            Create and manage accounts. Only the master admin can see this screen.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Plus size={16} />} onClick={openCreate}>Add Account</Button>
      </Box>

      <DataTable
        columns={columns} rows={users} loading={loading} minWidth={680}
        emptyState={{ icon: Users, title: 'No users', description: 'Add your first user account.', dense: true }}
        renderActions={(r) => {
          // The owner account is immutable to everyone else; only it can edit itself.
          const lockedByOwner = r.masterAdmin && !isSelf(r);
          return (
            <Box sx={{ display: 'inline-flex', gap: 0.5 }}>
              <Tooltip title={lockedByOwner ? 'The master admin account cannot be modified' : 'Edit'}>
                <span>
                  <IconButton size="small" disabled={lockedByOwner} onClick={() => openEdit(r)}>
                    <Pencil size={16} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={r.masterAdmin ? 'The master admin password can only be changed by its owner' : 'Reset password'}>
                <span>
                  <IconButton size="small" disabled={r.masterAdmin && !isSelf(r)} onClick={() => { setPwdRow(r); setNewPassword(''); }}>
                    <KeyRound size={16} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={
                r.masterAdmin ? 'The master admin cannot be deactivated'
                  : isSelf(r) ? 'You cannot deactivate your own account'
                    : r.active ? 'Deactivate' : 'Activate'
              }>
                <span>
                  <IconButton
                    size="small"
                    disabled={r.masterAdmin || isSelf(r)}
                    sx={{ color: r.active ? colors.warning : colors.success }}
                    onClick={() => handleToggleActive(r)}
                  >
                    {r.active ? <UserX size={16} /> : <UserCheck size={16} />}
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={
                r.masterAdmin ? 'The master admin cannot be deleted'
                  : isSelf(r) ? 'You cannot delete your own account' : 'Delete'
              }>
                <span>
                  <IconButton
                    size="small" sx={{ color: colors.danger }}
                    disabled={r.masterAdmin || isSelf(r)}
                    onClick={() => setDeleteRow(r)}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          );
        }}
      />

      {/* Create / edit */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editRow ? 'Edit Account' : 'Add Account'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField label="Name" fullWidth size="small" value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select label="Role" fullWidth size="small" value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                disabled={editRow?.masterAdmin}
                helperText={editRow?.masterAdmin ? 'The master admin role is fixed' : 'The master admin role cannot be assigned'}
              >
                {editRow?.masterAdmin && <MenuItem value="MASTER_ADMIN">Master Admin</MenuItem>}
                <MenuItem value="ADMIN">Administrator</MenuItem>
                <MenuItem value="USER">Member</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField label="Email" type="email" fullWidth size="small" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Grid>
            {!editRow && (
              <Grid item xs={12}>
                <TextField label="Password" type="password" fullWidth size="small" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  helperText="Minimum 6 characters" />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : editRow ? 'Save changes' : 'Create account'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset password */}
      <Dialog open={!!pwdRow} onClose={() => setPwdRow(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Reset Password</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.8125rem', color: colors.textSecondary, mb: 2 }}>
            Set a new password for <strong>{pwdRow?.email}</strong>. They will need it on their next sign-in.
          </Typography>
          <TextField
            label="New password" type="password" fullWidth size="small" autoFocus
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            helperText="Minimum 6 characters"
          />
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setPwdRow(null)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleResetPassword} disabled={saving}>
            {saving ? 'Saving…' : 'Reset password'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteRow} title="Delete Account"
        message={`This permanently removes ${deleteRow?.email || 'this account'}. Their historical records are kept.`}
        onConfirm={handleDelete} onCancel={() => setDeleteRow(null)} confirmText="Delete"
      />
    </Box>
  );
};

// ---- Settings page ---------------------------------------------------------
const SettingsPage = () => {
  const { role } = useAuth();
  const manageUsers = canManageUsers(role);
  const [grouped, setGrouped] = useState({});
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(0);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const notify = useCallback((message, severity = 'success') => setSnack({ open: true, message, severity }), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSettings();
      const data = res.data || {};
      setGrouped(data);
      const flat = {};
      Object.values(data).forEach((list) => list.forEach((s) => { flat[s.key] = s.value ?? ''; }));
      setValues(flat);
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  // Categories present, in TAB_ORDER. The Users tab only exists for the master
  // admin — every /users endpoint returns 403 for anyone else, so showing the tab
  // to a plain admin would just be a screen full of errors.
  const tabs = useMemo(
    () => TAB_ORDER.filter((c) => (c === 'USERS' ? manageUsers : grouped[c] && grouped[c].length)),
    [grouped, manageUsers]
  );

  // Guard against the selected index falling outside the list (e.g. tabs load in).
  const activeKey = tabs[Math.min(tab, Math.max(tabs.length - 1, 0))];

  const setValue = (key, value) => setValues((v) => ({ ...v, [key]: value }));

  const saveCategory = async (category) => {
    const keys = (grouped[category] || []).map((s) => s.key);
    const payload = {};
    keys.forEach((k) => { payload[k] = values[k]; });
    setSaving(true);
    try {
      const res = await updateSettings(payload);
      if (res.data) setGrouped(res.data);
      notify('Settings saved', 'success');
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderField = (s) => {
    const val = values[s.key] ?? '';
    if (s.valueType === 'boolean') {
      return (
        <FormControlLabel
          sx={{ m: 0 }}
          control={<Switch checked={val === 'true' || val === true} onChange={(e) => setValue(s.key, e.target.checked ? 'true' : 'false')} />}
          label={<Typography sx={{ fontSize: '0.8125rem' }}>{s.label}</Typography>}
        />
      );
    }
    if (SELECT_OPTIONS[s.key]) {
      return (
        <TextField select label={s.label} fullWidth size="small" value={val} onChange={(e) => setValue(s.key, e.target.value)}>
          {SELECT_OPTIONS[s.key].map((o) => <MenuItem key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</MenuItem>)}
        </TextField>
      );
    }
    return (
      <TextField
        label={s.label} fullWidth size="small"
        type={s.valueType === 'number' ? 'number' : 'text'}
        value={val} onChange={(e) => setValue(s.key, e.target.value)}
      />
    );
  };

  return (
    <Box>
      <PageHeader
        title="Settings"
        subtitle="Configure your organisation, preferences, inventory rules and more."
        icon={SettingsIcon}
        breadcrumbs={[{ label: 'System' }, { label: 'Settings' }]}
      />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
      ) : (
        <Card sx={{ overflow: 'hidden' }}>
          <Tabs
            value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
            sx={{ px: 1, borderBottom: `1px solid ${colors.border}`, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.9375rem', minHeight: 56 } }}
          >
            {tabs.map((c) => {
              const meta = c === 'USERS' ? { label: 'Users & Roles', icon: Users } : CATEGORY_META[c];
              const Icon = meta.icon;
              return <Tab key={c} icon={<Icon size={17} />} iconPosition="start" label={meta.label} />;
            })}
          </Tabs>

          <Box sx={{ p: { xs: 2.5, md: 3.5 } }}>
            {activeKey === 'USERS' ? (
              <UsersManager notify={notify} />
            ) : activeKey === 'BACKUP' ? (
              <Box>
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 650, mb: 0.25 }}>Backup &amp; Restore</Typography>
                <Typography sx={{ color: colors.textMuted, fontSize: '0.75rem', mb: 2.5 }}>{CATEGORY_META.BACKUP.desc}</Typography>
                <Grid container spacing={2}>
                  {(grouped.BACKUP || []).map((s) => (
                    <Grid item xs={12} sm={6} md={4} key={s.key} sx={{ display: 'flex', alignItems: 'center' }}>{renderField(s)}</Grid>
                  ))}
                </Grid>
                <Divider sx={{ my: 3 }} />
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Button variant="outlined" startIcon={<Download size={17} />} disabled>Export Backup</Button>
                  <Button variant="outlined" startIcon={<Upload size={17} />} disabled>Restore Backup</Button>
                  <Chip icon={<ShieldCheck size={15} />} label="Coming soon" sx={{ bgcolor: colors.infoSoft, color: colors.info, fontWeight: 600, '& .MuiChip-icon': { color: colors.info } }} />
                </Box>
                <Box sx={{ mt: 3 }}>
                  <Button variant="contained" startIcon={<Save size={17} />} onClick={() => saveCategory('BACKUP')} disabled={saving}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box>
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 650, mb: 0.25 }}>{CATEGORY_META[activeKey]?.label}</Typography>
                <Typography sx={{ color: colors.textMuted, fontSize: '0.75rem', mb: 2.5 }}>{CATEGORY_META[activeKey]?.desc}</Typography>
                {NOT_APPLIED_NOTE[activeKey] && (
                  <Alert severity="info" sx={{ mb: 2.5 }}>{NOT_APPLIED_NOTE[activeKey]}</Alert>
                )}
                <Grid container spacing={2}>
                  {(grouped[activeKey] || []).map((s) => (
                    <Grid item xs={12} sm={6} md={s.valueType === 'boolean' ? 6 : 4} key={s.key} sx={{ display: 'flex', alignItems: 'center' }}>
                      {renderField(s)}
                    </Grid>
                  ))}
                </Grid>
                <Box sx={{ mt: 3.5 }}>
                  <Button variant="contained" startIcon={<Save size={17} />} onClick={() => saveCategory(activeKey)} disabled={saving}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        </Card>
      )}

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack({ ...snack, open: false })}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default SettingsPage;
