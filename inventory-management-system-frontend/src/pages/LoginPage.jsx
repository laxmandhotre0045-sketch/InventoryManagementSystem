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
import BrandLogo from '../components/ui/BrandLogo';
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

/**
 * Turns a failed sign-in into an accurate message.
 *
 * Only a 401 actually means the credentials were wrong. Reporting "Invalid email or
 * password" for every failure hides the common cases — the API being unreachable or
 * erroring — and sends people hunting for a password problem that doesn't exist.
 */
const describeLoginError = (err) => {
  const status = err.response?.status;

  if (status === 401) {
    return err.response?.data?.message || 'Invalid email or password.';
  }
  if (status === 400) {
    return err.response?.data?.message || 'Please enter a valid email address and password.';
  }
  if (status === 429) {
    return 'Too many sign-in attempts. Please wait a moment and try again.';
  }
  if (!err.response) {
    // No HTTP response at all: server down, DNS/proxy failure, or the request timed out.
    return 'Cannot reach the server. Check that the backend is running, then try again.';
  }
  if (status >= 500) {
    return `The server could not process the sign-in (error ${status}). `
      + 'This is not a password problem — check the backend logs.';
  }
  return err.response?.data?.message || `Sign-in failed (error ${status}).`;
};

/**
 * Height-driven scaling roots.
 *
 * The page must fit 100dvh with no scrolling. Rather than clamping each element
 * against the viewport separately — which is what let the panel outgrow the screen
 * and start scrolling internally, hiding the logo — each panel declares ONE root
 * font size derived from viewport height, and every child is sized in `em`.
 *
 * Type, gaps, padding and icon boxes then shrink in lockstep, so the composition
 * keeps its proportions at 768px height instead of turning into small text with
 * unchanged whitespace.
 *
 * The brand panel's content measures ~40em tall, so the root must stay under
 * 100/40 = 2.5vh for it to fit; 2.1vh leaves roughly 15% headroom for a heading
 * or description that wraps onto an extra line. The `vw` term stops the type
 * getting oversized on a short-but-wide window.
 */
const BRAND_SCALE = 'clamp(9px, min(2.1vh, 1.5vw), 15.5px)';
const FORM_SCALE = 'clamp(12px, 2.4vh, 16px)';

// Readable placeholder, subtle brand focus glow. Sizing is em-relative so the
// field scales with the form panel's root.
const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '0.7em',
    fontSize: '0.95em',
    transition: 'box-shadow .2s ease, border-color .2s ease, background-color .2s ease',
    '&:hover': { backgroundColor: '#FCFCFB' },
  },
  '& .MuiOutlinedInput-input': { paddingTop: '0.85em', paddingBottom: '0.85em', fontSize: '1em' },
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
      navigate('/modules', { replace: true });
    } catch (err) {
      setError(describeLoginError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ height: '100dvh', display: 'flex', bgcolor: colors.canvas, overflow: 'hidden' }}>
      {/* Left — portal identity + module index */}
      <Box
        sx={{
          // Every child below is sized in em against this root.
          fontSize: BRAND_SCALE,
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '1.5em',
          width: { md: '52%' },
          px: 'clamp(1.5rem, 4vw, 5rem)',
          py: '1.6em',
          color: colors.textPrimary,
          position: 'relative',
          minHeight: 0,
          // Never scroll: the scale above guarantees the content fits, and an
          // overflow here is what previously cut the logo off the top.
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

        <Box sx={{ position: 'relative', zIndex: 1, flexShrink: 0 }}>
          {/*
            17em wide, and the panel root tops out at 15.5px, so the rendered
            width never exceeds ~264px — comfortably inside the 800px artwork
            even on a 2x display, so it stays sharp.
          */}
          <BrandLogo width="17em" />
        </Box>

        <Box sx={{ position: 'relative', zIndex: 1, minHeight: 0 }}>
          <Typography sx={{ fontSize: '0.72em', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: colors.textMuted, mb: '0.55em' }}>
            Enterprise Inventory System
          </Typography>
          <Typography sx={{ fontSize: '2.5em', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.03em', mb: '0.28em', maxWidth: '14em' }}>
            Inventory Management Portal
          </Typography>
          <Typography sx={{ fontSize: '1em', color: colors.textSecondary, mb: '1.2em', maxWidth: '30em', lineHeight: 1.55 }}>
            Central platform for stock control, equipment records, and procurement across SensoVibe operations.
          </Typography>

          <Typography sx={{ fontSize: '0.68em', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: colors.textMuted, mb: '0.7em' }}>
            Core Modules
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '1.4em', rowGap: '0.3em', maxWidth: '36em', ml: '-0.7em' }}>
            {modules.map((m) => (
              <Box
                key={m.label}
                sx={{
                  display: 'flex', gap: '0.75em', alignItems: 'flex-start',
                  p: '0.7em', borderRadius: '0.7em',
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
                    width: '2.3em', height: '2.3em', borderRadius: '0.5em', display: 'grid', placeItems: 'center',
                    bgcolor: 'rgba(34,73,127,0.06)', color: colors.primary, flexShrink: 0,
                    transition: 'transform .22s cubic-bezier(.4,0,.2,1), background-color .22s ease',
                  }}
                >
                  {/* 1em box → the glyph tracks the panel scale like everything else. */}
                  <m.icon size="1.15em" strokeWidth={1.9} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.9em', fontWeight: 600, letterSpacing: '-0.01em', mb: '0.15em' }}>
                    {m.label}
                  </Typography>
                  <Typography sx={{ fontSize: '0.8em', color: colors.textSecondary, lineHeight: 1.4 }}>
                    {m.desc}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        <Typography sx={{ fontSize: '0.78em', color: colors.textMuted, position: 'relative', zIndex: 1, flexShrink: 0 }}>
          Access restricted to authorized SensoVibe personnel.
        </Typography>
      </Box>

      {/* Right — sign-in card */}
      <Box
        sx={{
          fontSize: FORM_SCALE,
          width: { xs: '100%', md: '48%' },
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 0,
          // Scaled to fit, but a phone in landscape can still scroll rather than clip.
          overflowY: 'auto',
          p: '1.5em',
        }}
      >
        <Box sx={{ width: '100%', maxWidth: '31em' }}>
          {/* Mobile logo */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'center', mb: '1.5em' }}>
            <BrandLogo width="min(14em, 55vw)" />
          </Box>

          <Card
            sx={{
              p: '1.8em',
              borderRadius: '1.1em',
              border: '1px solid rgba(34,73,127,0.09)',
              // Layered shadow: contact + mid + ambient — a refined float, not a drop
              boxShadow:
                '0 1px 2px rgba(16,24,40,0.04), 0 8px 20px rgba(16,24,40,0.04), 0 28px 56px rgba(16,24,40,0.05)',
            }}
          >
            <Typography sx={{ fontSize: '1.6em', fontWeight: 700, letterSpacing: '-0.025em', mb: '0.15em' }}>
              Sign in
            </Typography>
            <Typography sx={{ fontSize: '0.9em', color: colors.textSecondary, mb: '1.2em', lineHeight: 1.5 }}>
              Use your SensoVibe account to continue.
            </Typography>

            {error && <Alert severity="error" sx={{ mb: '1em', fontSize: '0.82em' }}>{error}</Alert>}

            <Box component="form" onSubmit={handleSubmit}>
              <Typography sx={{ fontSize: '0.85em', fontWeight: 600, mb: '0.45em' }}>Company Email</Typography>
              <TextField
                type="email" fullWidth required placeholder="name@sensovibe.com" value={email}
                onChange={(e) => setEmail(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Mail size="1.05em" color={colors.textMuted} /></InputAdornment> }}
                sx={{ mb: '1em', ...fieldSx }}
              />

              <Typography sx={{ fontSize: '0.85em', fontWeight: 600, mb: '0.45em' }}>Password</Typography>
              <TextField
                type={showPassword ? 'text' : 'password'} fullWidth required placeholder="Enter your password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Lock size="1.05em" color={colors.textMuted} /></InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword((s) => !s)} edge="end" size="small" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                        {showPassword ? <EyeOff size="1.05em" /> : <Eye size="1.05em" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: '1.3em', ...fieldSx }}
              />

              <Button
                type="submit" variant="contained" fullWidth disabled={loading}
                sx={{
                  // Floor keeps a comfortable touch target on small phones.
                  height: 'max(44px, 2.9em)', fontSize: '0.95em', fontWeight: 600, borderRadius: '0.65em',
                  boxShadow: '0 1px 2px rgba(16,24,40,0.06)',
                  transition: 'transform .22s cubic-bezier(.4,0,.2,1), box-shadow .22s cubic-bezier(.4,0,.2,1), background-color .22s ease',
                  '&:hover': { transform: 'translateY(-1.5px)', boxShadow: '0 10px 22px rgba(34,73,127,0.22)' },
                  '&:active': { transform: 'translateY(0)', boxShadow: '0 1px 2px rgba(16,24,40,0.06)' },
                }}
              >
                {loading ? <CircularProgress size="1.3em" color="inherit" /> : 'Sign in'}
              </Button>

              {/* Trust indicators */}
              <Box
                sx={{
                  display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center',
                  columnGap: '1.1em', rowGap: '0.4em', mt: '1.1em', color: colors.textMuted,
                }}
              >
                {trustPoints.map((t) => (
                  <Box key={t.label} sx={{ display: 'flex', alignItems: 'center', gap: '0.35em' }}>
                    <t.icon size="0.85em" strokeWidth={2} />
                    <Typography sx={{ fontSize: '0.75em', whiteSpace: 'nowrap' }}>{t.label}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Card>

          {/* Single-line internal-use footer */}
          <Typography sx={{ mt: '0.9em', textAlign: 'center', fontSize: '0.72em', color: colors.textMuted }}>
            © 2026 SensoVibe Reliability Pvt. Ltd. • Internal Use Only • {APP_VERSION}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default LoginPage;
