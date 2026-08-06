import { Box, Grid, Card, Typography, Divider } from '@mui/material';
import {
  Settings, CalendarClock, Hash, BookOpen, ShieldCheck, Info,
} from 'lucide-react';
import { PageHeader } from '../../components/ui';
import { colors } from '../../theme/tokens';

const InfoCard = ({ icon: Icon, title, value, description, tone = colors.primary, soft = colors.primarySoft }) => (
  <Card sx={{ p: 3, height: '100%' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, mb: 2 }}>
      <Box sx={{ width: 46, height: 46, borderRadius: '13px', display: 'grid', placeItems: 'center', bgcolor: soft, color: tone, flexShrink: 0 }}>
        <Icon size={23} strokeWidth={2} />
      </Box>
      <Box>
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>{title}</Typography>
        <Typography sx={{ fontSize: '1rem', fontWeight: 650, color: colors.textPrimary }}>{value}</Typography>
      </Box>
    </Box>
    <Divider sx={{ mb: 1.5 }} />
    <Typography sx={{ fontSize: '0.875rem', color: colors.textSecondary }}>{description}</Typography>
  </Card>
);

const LibrarySettingsPage = () => (
  <Box>
    <PageHeader
      title="Settings"
      subtitle="Book Management configuration and system defaults."
      icon={Settings}
      breadcrumbs={[{ label: 'Library' }, { label: 'Settings' }]}
    />

    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid item xs={12} sm={6} md={4}>
        <InfoCard icon={CalendarClock} title="Default Loan Period" value="14 days"
          description="When a due date isn't specified at issue time, books are due two weeks from the issue date." />
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <InfoCard icon={Hash} title="Book Code Format" value="BK0001" tone="#6B5CA5" soft="#F6F3FB"
          description="Book codes are generated automatically in sequence and are unique and immutable." />
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <InfoCard icon={BookOpen} title="Copy Tracking" value="Per title" tone="#3C8C6A" soft="#EDF5F0"
          description="Each title tracks total and available copies; availability adjusts automatically on issue and return." />
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <InfoCard icon={ShieldCheck} title="Overdue Detection" value="Automatic" tone="#B47B2E" soft="#FCF7EF"
          description="Any active loan past its due date is flagged as overdue in real time — no manual step needed." />
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <InfoCard icon={Info} title="Transaction Safety" value="All-or-nothing"
          description="Issuing and returning update copy counts and records atomically, so inventory can never drift." />
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <InfoCard icon={Settings} title="Module" value="Independent" tone="#BC4F47" soft="#FCF2F0"
          description="Book Management runs separately from Inventory Management, sharing only your login." />
      </Grid>
    </Grid>

    <Card sx={{ p: 3 }}>
      <Typography sx={{ fontSize: '0.9375rem', fontWeight: 650, mb: 0.5 }}>About this module</Typography>
      <Typography sx={{ fontSize: '0.9375rem', color: colors.textSecondary, maxWidth: 720 }}>
        The Book Management module provides a complete company-library workflow — catalogue management, member records,
        issuing and returning books, and lending reports. It uses the same authentication as Inventory Management but
        stores its data in its own separate tables and endpoints.
      </Typography>
    </Card>
  </Box>
);

export default LibrarySettingsPage;
