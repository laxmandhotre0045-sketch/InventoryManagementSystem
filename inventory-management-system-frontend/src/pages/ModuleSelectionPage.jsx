import { Box, Typography, Button, Card } from '@mui/material';
import { Boxes, Library, ArrowRight, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { colors, shadows } from '../theme/tokens';

// Post-login landing: pick which module to work in. Inventory Management is the
// existing, unchanged app; Book Management is the separate library module.
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
  },
];

const ModuleSelectionPage = () => {
  const navigate = useNavigate();
  const { email, logout } = useAuth();
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
            return (
              <Card
                key={m.key}
                onClick={() => navigate(m.path)}
                sx={{
                  p: { xs: 3, md: 4 },
                  cursor: 'pointer',
                  border: `1px solid ${colors.border}`,
                  boxShadow: shadows.card,
                  transition: 'transform .22s cubic-bezier(.4,0,.2,1), box-shadow .22s ease, border-color .22s ease',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: shadows.cardHover, borderColor: m.accent },
                  '&:hover .go': { gap: 1.25, color: m.accent },
                }}
              >
                <Box
                  sx={{
                    width: 64, height: 64, borderRadius: '18px', display: 'grid', placeItems: 'center',
                    bgcolor: m.soft, color: m.accent, mb: 3,
                  }}
                >
                  <Icon size={32} strokeWidth={1.9} />
                </Box>
                <Typography sx={{ fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.015em', mb: 1 }}>
                  {m.title}
                </Typography>
                <Typography sx={{ fontSize: '1rem', color: colors.textSecondary, mb: 3, minHeight: 48 }}>
                  {m.description}
                </Typography>
                <Box className="go" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, color: colors.textPrimary, fontWeight: 600, transition: 'gap .2s ease, color .2s ease' }}>
                  Open module <ArrowRight size={18} />
                </Box>
              </Card>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

export default ModuleSelectionPage;
