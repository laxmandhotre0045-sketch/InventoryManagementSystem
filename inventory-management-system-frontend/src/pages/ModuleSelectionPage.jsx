import { Box, Typography, Button, Card, Chip } from '@mui/material';
import { Boxes, Library, ArrowRight, LogOut, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { isAdmin } from '../utils/roleUtils';
import { colors, shadows } from '../theme/tokens';

// Post-login landing: pick which module to work in. Inventory Management is the
// existing, unchanged app; Book Management is the separate library module.
// `adminOnly` mirrors the backend rule — every /library endpoint requires ADMIN,
// so the card is shown locked rather than opening a UI that would only 403.
const modules = [
  {
    key: 'inventory',
    title: 'Inventory Management',
    description: 'Track equipment, components, stock, suppliers, purchases and projects.',
    icon: Boxes,
    path: '/dashboard',
    accent: colors.primary,
    soft: colors.primarySoft,
  },
  {
    key: 'library',
    title: 'Book Management',
    description: 'Run the company library — books, members, issues, returns and reports.',
    icon: Library,
    path: '/library/dashboard',
    accent: '#3C8C6A',
    soft: '#EDF5F0',
    adminOnly: true,
  },
];

const ModuleSelectionPage = () => {
  const navigate = useNavigate();
  const { email, role, logout } = useAuth();
  const admin = isAdmin(role);
  const name = email?.split('@')[0] || 'there';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: colors.canvas, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: { xs: 3, md: 6 }, py: 3 }}>
        <Box component="img" src="/sensovibe-logo.svg" alt="SensoVibe" sx={{ height: 34 }} />
        <Button variant="text" startIcon={<LogOut size={18} />} onClick={logout} sx={{ color: colors.textSecondary }}>
          Log out
        </Button>
      </Box>

      {/* Center content */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', px: 3, py: { xs: 4, md: 6 } }}>
        <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 }, maxWidth: 640 }}>
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.primary, mb: 1.5 }}>
            Welcome back, {name}
          </Typography>
          <Typography variant="h1" sx={{ fontSize: { xs: '2rem', md: '2.75rem' }, fontWeight: 700, letterSpacing: '-0.02em', mb: 1.5 }}>
            Choose a module
          </Typography>
          <Typography sx={{ fontSize: '1.125rem', color: colors.textSecondary }}>
            Select the workspace you want to open. You can switch anytime.
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 340px))' },
            gap: { xs: 2.5, md: 3.5 },
            width: '100%',
            maxWidth: 760,
          }}
        >
          {modules.map((m) => {
            const Icon = m.icon;
            const locked = m.adminOnly && !admin;
            return (
              <Card
                key={m.key}
                onClick={locked ? undefined : () => navigate(m.path)}
                aria-disabled={locked || undefined}
                sx={{
                  p: { xs: 3, md: 4 },
                  cursor: locked ? 'not-allowed' : 'pointer',
                  border: `1px solid ${colors.border}`,
                  boxShadow: shadows.card,
                  transition: 'transform .22s cubic-bezier(.4,0,.2,1), box-shadow .22s ease, border-color .22s ease',
                  ...(locked
                    ? { bgcolor: '#FBFAF8' }
                    : {
                        '&:hover': { transform: 'translateY(-4px)', boxShadow: shadows.cardHover, borderColor: m.accent },
                        '&:hover .go': { gap: 1.25, color: m.accent },
                      }),
                }}
              >
                <Box
                  sx={{
                    width: 64, height: 64, borderRadius: '18px', display: 'grid', placeItems: 'center',
                    bgcolor: locked ? '#F2F1EE' : m.soft, color: locked ? colors.textMuted : m.accent, mb: 3,
                  }}
                >
                  <Icon size={32} strokeWidth={1.9} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.015em', color: locked ? colors.textSecondary : colors.textPrimary }}>
                    {m.title}
                  </Typography>
                  {locked && (
                    <Chip
                      size="small"
                      icon={<Lock size={13} />}
                      label="Admins only"
                      sx={{ bgcolor: '#F2F1EE', color: colors.textSecondary, fontWeight: 600, '& .MuiChip-icon': { color: colors.textSecondary } }}
                    />
                  )}
                </Box>
                <Typography sx={{ fontSize: '1rem', color: colors.textSecondary, mb: 3, minHeight: 48 }}>
                  {m.description}
                </Typography>
                {locked ? (
                  <Typography sx={{ fontSize: '0.9375rem', color: colors.textMuted, fontWeight: 500 }}>
                    Ask an administrator for access.
                  </Typography>
                ) : (
                  <Box className="go" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, color: colors.textPrimary, fontWeight: 600, transition: 'gap .2s ease, color .2s ease' }}>
                    Open module <ArrowRight size={18} />
                  </Box>
                )}
              </Card>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

export default ModuleSelectionPage;
