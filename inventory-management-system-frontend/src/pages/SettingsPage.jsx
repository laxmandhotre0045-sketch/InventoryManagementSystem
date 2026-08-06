import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Card, Tabs, Tab, Grid, TextField, MenuItem, Switch, FormControlLabel,
  Button, Typography, Divider, Snackbar, Alert, CircularProgress, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Tooltip, Chip,
} from '@mui/material';
import {
  Settings as SettingsIcon, Building2, SlidersHorizontal, Boxes, Bell, Palette,
  DatabaseBackup, Users, Save, Plus, Trash2, Download, Upload, ShieldCheck,
} from 'lucide-react';
import { getSettings, updateSettings } from '../api/settingsApi';
import { getUsers, createUser, updateUserRole, deleteUser } from '../api/userApi';
import { useAuth } from '../auth/AuthContext';
import DataTable from '../components/common/DataTable';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { PageHeader } from '../components/ui';
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

// ---- Users & Roles manager -------------------------------------------------
const UsersManager = ({ notify }) => {
  const { email: myEmail } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'USER' });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await getUsers(); setUsers(res.data || []); }
    catch (err) { notify(err.response?.data?.message || 'Failed to load users', 'error'); }
    finally { setLoading(false); }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.username.trim() || !form.email.trim() || !form.password) {
      notify('Name, email and password are required', 'error'); return;
    }
    setSaving(true);
    try {
      await createUser(form);
      notify('User created', 'success');
      setDialogOpen(false);
      setForm({ username: '', email: '', password: '', role: 'USER' });
      load();
    } catch (err) { notify(err.response?.data?.message || 'Failed to create user', 'error'); }
    finally { setSaving(false); }
  };

  const handleRole = async (id, role) => {
    try { await updateUserRole(id, role); notify('Role updated', 'success'); load(); }
    catch (err) { notify(err.response?.data?.message || 'Failed to update role', 'error'); }
  };

  const handleDelete = async () => {
    try { await deleteUser(deleteId); notify('User deleted', 'success'); setDeleteId(null); load(); }
    catch (err) { notify(err.response?.data?.message || 'Failed to delete user', 'error'); }
  };

  const columns = [
    { field: 'username', headerName: 'Name', render: (r) => <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600 }}>{r.username}</Typography> },
    { field: 'email', headerName: 'Email' },
    {
      field: 'role', headerName: 'Role',
      render: (r) => (
        <TextField
          select size="small" value={r.role}
          onChange={(e) => handleRole(r.id, e.target.value)}
          sx={{ minWidth: 120 }}
          disabled={r.email?.toLowerCase() === myEmail?.toLowerCase()}
        >
          <MenuItem value="ADMIN">Admin</MenuItem>
          <MenuItem value="USER">User</MenuItem>
        </TextField>
      ),
    },
    { field: 'you', headerName: '', render: (r) => (r.email?.toLowerCase() === myEmail?.toLowerCase() ? <Chip size="small" label="You" sx={{ bgcolor: colors.primarySoft, color: colors.primary, fontWeight: 600 }} /> : null) },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: '1.125rem', fontWeight: 700 }}>Users &amp; Roles</Typography>
          <Typography sx={{ color: colors.textMuted, fontSize: '0.875rem' }}>Manage who can access the system and their permissions.</Typography>
        </Box>
        <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setDialogOpen(true)}>Add User</Button>
      </Box>

      <DataTable
        columns={columns} rows={users} loading={loading} minWidth={560}
        emptyState={{ icon: Users, title: 'No users', description: 'Add your first user account.', dense: true }}
        renderActions={(r) => (
          <Tooltip title={r.email?.toLowerCase() === myEmail?.toLowerCase() ? 'You cannot delete yourself' : 'Delete'}>
            <span>
              <IconButton size="small" sx={{ color: colors.danger }} disabled={r.email?.toLowerCase() === myEmail?.toLowerCase()} onClick={() => setDeleteId(r.id)}>
                <Trash2 size={18} />
              </IconButton>
            </span>
          </Tooltip>
        )}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add User</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}><TextField label="Name" fullWidth value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}>
              <TextField select label="Role" fullWidth value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <MenuItem value="ADMIN">Admin</MenuItem>
                <MenuItem value="USER">User</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}><TextField label="Email" type="email" fullWidth value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Grid>
            <Grid item xs={12}><TextField label="Password" type="password" fullWidth value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} helperText="Minimum 6 characters" /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>{saving ? 'Saving…' : 'Create User'}</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteId} title="Delete User" message="This will permanently remove the user account."
        onConfirm={handleDelete} onCancel={() => setDeleteId(null)} confirmText="Delete" />
    </Box>
  );
};

// ---- Settings page ---------------------------------------------------------
const SettingsPage = () => {
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

  // Categories present, in TAB_ORDER, with USERS injected after COMPANY.
  const tabs = useMemo(() => {
    const present = TAB_ORDER.filter((c) => c === 'USERS' || (grouped[c] && grouped[c].length));
    return present;
  }, [grouped]);

  const activeKey = tabs[tab];

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
          label={<Typography sx={{ fontSize: '0.9375rem' }}>{s.label}</Typography>}
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
                <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, mb: 0.5 }}>Backup &amp; Restore</Typography>
                <Typography sx={{ color: colors.textMuted, fontSize: '0.875rem', mb: 2.5 }}>{CATEGORY_META.BACKUP.desc}</Typography>
                <Grid container spacing={2.5}>
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
                <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, mb: 0.5 }}>{CATEGORY_META[activeKey]?.label}</Typography>
                <Typography sx={{ color: colors.textMuted, fontSize: '0.875rem', mb: 2.5 }}>{CATEGORY_META[activeKey]?.desc}</Typography>
                {NOT_APPLIED_NOTE[activeKey] && (
                  <Alert severity="info" sx={{ mb: 2.5 }}>{NOT_APPLIED_NOTE[activeKey]}</Alert>
                )}
                <Grid container spacing={2.5}>
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
