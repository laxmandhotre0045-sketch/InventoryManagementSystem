import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Card, TextField, Typography, Alert, CircularProgress, InputAdornment, IconButton,
} from '@mui/material';
import {
  Mail, Lock, Eye, EyeOff, ShieldCheck, KeyRound, UserCheck,
  Cpu, CircuitBoard, Warehouse, Truck, FolderKanban, ShoppingCart,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme/tokens';

const APP_VERSION = 'v1.4.2';

// What the portal covers — an informative index, not navigation.
const modules = [
  { icon: Cpu, label: 'Equipment', desc: 'Assets, serials, service status' },
  { icon: CircuitBoard, label: 'Components', desc: 'Parts, stock levels, reorder points' },
  { icon: Warehouse, label: 'Warehouse', desc: 'Stock in and stock out movements' },
  { icon: Truck, label: 'Suppliers', desc: 'Vendors and purchase history' },
  { icon: FolderKanban, label: 'Projects', desc: 'Component usage by project' },
  { icon: ShoppingCart, label: 'Purchases', desc: 'Orders and invoice records' },
];

const trustPoints = [
  { icon: ShieldCheck, label: 'Secure Login' },
  { icon: KeyRound, label: 'Role-Based Access' },
  { icon: UserCheck, label: 'Authorized Personnel Only' },
];

// Taller inputs, readable placeholder, subtle brand focus glow.
const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    transition: 'box-shadow .2s ease, border-color .2s ease, background-color .2s ease',
    '&:hover': { backgroundColor: '#FCFCFB' },
  },
  '& .MuiOutlinedInput-input': { paddingTop: '17.5px', paddingBottom: '17.5px' },
  '& input::placeholder': { color: colors.textSecondary, opacity: 0.7 },
};

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: colors.canvas }}>
      {/* Left — portal identity + module index */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: { md: '52%' },
          px: { md: 8, lg: 11, xl: 13 },
          py: { md: 8, lg: 9 },
          color: colors.textPrimary,
          position: 'relative',
          overflow: 'hidden',
          borderRight: `1px solid ${colors.border}`,
          bgcolor: '#FAF9F6',
          // Blueprint grid kept as faint texture so the illustration reads first
          backgroundImage:
            'linear-gradient(rgba(34,73,127,0.013) 1px, transparent 1px), linear-gradient(90deg, rgba(34,73,127,0.013) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      >
        {/*
          Industrial background illustration — warehouse racking with stored
          cartons, PCB traces, a logistics route and blueprint dimension marks,
          tied together by the SensoVibe waveform. Held at 5–7% so it is
          noticeable as texture without competing with the content.
        */}
        <Box
          component="svg"
          viewBox="0 0 900 700"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}
        >
          {/* Warehouse racking with stored cartons (lower left) */}
          <g fill="none" stroke="#22497F" strokeOpacity="0.07" strokeWidth="1.35">
            <path d="M56 418 V640 M204 418 V640 M352 418 V640" />
            <path d="M56 418 H352 M56 492 H352 M56 566 H352 M56 640 H352" />
            <rect x="76" y="442" width="58" height="44" rx="3" />
            <rect x="146" y="442" width="46" height="44" rx="3" />
            <rect x="224" y="442" width="60" height="44" rx="3" />
            <rect x="76" y="516" width="50" height="44" rx="3" />
            <rect x="224" y="516" width="54" height="44" rx="3" />
            <rect x="146" y="590" width="58" height="44" rx="3" />
            {/* carton tape lines */}
            <path d="M105 442 V486 M169 442 V486 M254 442 V486" strokeOpacity="0.05" />
          </g>

          {/* PCB traces with junction pads (mid right) */}
          <g fill="none" stroke="#22497F" strokeOpacity="0.065" strokeWidth="1.35">
            <path d="M596 388 H700 V452 H806" />
            <path d="M648 316 V388" />
            <path d="M700 452 V516 H620" />
            <circle cx="596" cy="388" r="4.5" fill="#22497F" fillOpacity="0.07" stroke="none" />
            <circle cx="700" cy="452" r="4.5" fill="#22497F" fillOpacity="0.07" stroke="none" />
            <circle cx="806" cy="452" r="4.5" fill="#22497F" fillOpacity="0.07" stroke="none" />
            <circle cx="648" cy="316" r="4.5" fill="#22497F" fillOpacity="0.07" stroke="none" />
            <circle cx="620" cy="516" r="4.5" fill="#22497F" fillOpacity="0.07" stroke="none" />
          </g>

          {/* Logistics route with waypoints (upper right) */}
          <g fill="none" stroke="#22497F" strokeOpacity="0.06" strokeWidth="1.35">
            <path d="M528 196 L624 122 L728 172 L848 106" strokeDasharray="6 8" />
            <circle cx="528" cy="196" r="6" />
            <circle cx="624" cy="122" r="6" />
            <circle cx="728" cy="172" r="6" />
            <circle cx="848" cy="106" r="6" />
          </g>

          {/* Blueprint dimension marks (upper left) */}
          <g fill="none" stroke="#22497F" strokeOpacity="0.055" strokeWidth="1.2">
            <path d="M64 150 H286" />
            <path d="M64 142 V158 M286 142 V158" />
            <path d="M64 196 H180" />
            <path d="M64 188 V204 M180 188 V204" />
          </g>

          {/* SensoVibe waveform threading the composition */}
          <path
            d="M-40 272 C 70 224, 150 320, 260 272 S 440 224, 550 272 S 730 320, 840 272 S 940 244, 980 272"
            fill="none" stroke="#22497F" strokeOpacity="0.07" strokeWidth="1.6"
          />
          <path
            d="M-40 292 C 80 258, 170 326, 280 292 S 460 258, 570 292 S 750 326, 860 292 S 950 266, 990 292"
            fill="none" stroke="#E08A22" strokeOpacity="0.055" strokeWidth="1.3"
          />
        </Box>

        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box component="img" src="/sensovibe-logo.svg" alt="SensoVibe" sx={{ width: '100%', maxWidth: 515, height: 'auto', display: 'block' }} />
        </Box>

        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: colors.textMuted, mb: 2 }}>
            Enterprise Inventory System
          </Typography>
          <Typography sx={{ fontSize: { md: '2.75rem', lg: '3rem' }, fontWeight: 700, lineHeight: 1.08, letterSpacing: '-0.032em', mb: 2.5, maxWidth: 560 }}>
            Inventory Management Portal
          </Typography>
          <Typography sx={{ fontSize: '1.1875rem', color: colors.textSecondary, mb: 7, maxWidth: 500, lineHeight: 1.7 }}>
            Central platform for stock control, equipment records, and procurement across SensoVibe operations.
          </Typography>

          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: colors.textMuted, mb: 2.5 }}>
            Core Modules
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 3, rowGap: 1.5, maxWidth: 580, ml: -1.75 }}>
            {modules.map((m) => (
              <Box
                key={m.label}
                sx={{
                  display: 'flex', gap: 2, alignItems: 'flex-start',
                  p: 1.75, borderRadius: '14px',
                  border: '1px solid transparent',
                  transition: 'transform .22s cubic-bezier(.4,0,.2,1), background-color .22s ease, border-color .22s ease, box-shadow .22s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    bgcolor: 'rgba(255,255,255,0.75)',
                    borderColor: 'rgba(34,73,127,0.16)',
                    boxShadow: '0 8px 20px rgba(16,24,40,0.06)',
                  },
                  '&:hover .mod-ico': { transform: 'scale(1.09)', bgcolor: colors.primarySoft },
                }}
              >
                <Box
                  className="mod-ico"
                  sx={{
                    width: 38, height: 38, borderRadius: '10px', display: 'grid', placeItems: 'center',
                    bgcolor: 'rgba(34,73,127,0.06)', color: colors.primary, flexShrink: 0, mt: '1px',
                    transition: 'transform .22s cubic-bezier(.4,0,.2,1), background-color .22s ease',
                  }}
                >
                  <m.icon size={19} strokeWidth={1.9} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 600, letterSpacing: '-0.01em', mb: 0.5 }}>
                    {m.label}
                  </Typography>
                  <Typography sx={{ fontSize: '0.9375rem', color: colors.textSecondary, lineHeight: 1.5 }}>
                    {m.desc}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        <Typography sx={{ fontSize: '0.8125rem', color: colors.textMuted, position: 'relative', zIndex: 1 }}>
          Access restricted to authorized SensoVibe personnel.
        </Typography>
      </Box>

      {/* Right — sign-in card */}
      <Box sx={{ width: { xs: '100%', md: '48%' }, flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: { xs: 3, sm: 6 } }}>
        <Box sx={{ width: '100%', maxWidth: 508 }}>
          {/* Mobile logo */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'center', mb: 4.5 }}>
            <Box component="img" src="/sensovibe-logo.svg" alt="SensoVibe" sx={{ width: '100%', maxWidth: 260, height: 'auto' }} />
          </Box>

          <Card
            sx={{
              p: { xs: 3.5, sm: 5.5 },
              borderRadius: '24px',
              border: '1px solid rgba(34,73,127,0.09)',
              // Layered shadow: contact + mid + ambient — a refined float, not a drop
              boxShadow:
                '0 1px 2px rgba(16,24,40,0.04), 0 8px 20px rgba(16,24,40,0.04), 0 28px 56px rgba(16,24,40,0.05)',
            }}
          >
            <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.025em', mb: 0.75 }}>
              Sign in
            </Typography>
            <Typography sx={{ fontSize: '1.0625rem', color: colors.textSecondary, mb: 4, lineHeight: 1.6 }}>
              Use your SensoVibe account to continue.
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            <Box component="form" onSubmit={handleSubmit}>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, mb: 1.125 }}>Company Email</Typography>
              <TextField
                type="email" fullWidth required placeholder="name@sensovibe.com" value={email}
                onChange={(e) => setEmail(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Mail size={18} color={colors.textMuted} /></InputAdornment> }}
                sx={{ mb: 3.25, ...fieldSx }}
              />

              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, mb: 1.125 }}>Password</Typography>
              <TextField
                type={showPassword ? 'text' : 'password'} fullWidth required placeholder="Enter your password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Lock size={18} color={colors.textMuted} /></InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword((s) => !s)} edge="end" size="small">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 4.25, ...fieldSx }}
              />

              <Button
                type="submit" variant="contained" fullWidth disabled={loading}
                sx={{
                  height: 56, fontSize: '1.0625rem', fontWeight: 600, borderRadius: '12px',
                  boxShadow: '0 1px 2px rgba(16,24,40,0.06)',
                  transition: 'transform .22s cubic-bezier(.4,0,.2,1), box-shadow .22s cubic-bezier(.4,0,.2,1), background-color .22s ease',
                  '&:hover': { transform: 'translateY(-1.5px)', boxShadow: '0 10px 22px rgba(34,73,127,0.22)' },
                  '&:active': { transform: 'translateY(0)', boxShadow: '0 1px 2px rgba(16,24,40,0.06)' },
                }}
              >
                {loading ? <CircularProgress size={22} color="inherit" /> : 'Sign in'}
              </Button>

              {/* Trust indicators */}
              <Box
                sx={{
                  display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center',
                  columnGap: 2.25, rowGap: 1, mt: 3, color: colors.textMuted,
                }}
              >
                {trustPoints.map((t) => (
                  <Box key={t.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <t.icon size={14} strokeWidth={2} />
                    <Typography sx={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{t.label}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Card>

          {/* Single-line internal-use footer */}
          <Typography sx={{ mt: 3, textAlign: 'center', fontSize: '0.8125rem', color: colors.textMuted }}>
            © 2026 SensoVibe Reliability Pvt. Ltd. • Internal Use Only • {APP_VERSION}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default LoginPage;
