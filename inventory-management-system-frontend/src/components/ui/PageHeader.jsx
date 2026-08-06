import { Box, Typography, Breadcrumbs, Link } from '@mui/material';
import { ChevronRight } from 'lucide-react';
import { colors } from '../../theme/tokens';

// Consistent page header: breadcrumb, big title, subtitle, and right-aligned actions.
const PageHeader = ({ title, subtitle, breadcrumbs = [], actions, icon: Icon }) => (
  <Box
    sx={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: { xs: 'flex-start', sm: 'center' },
      justifyContent: 'space-between',
      gap: 2,
      mb: 2.5,
    }}
  >
    <Box sx={{ minWidth: 0 }}>
      {breadcrumbs.length > 0 && (
        <Breadcrumbs
          separator={<ChevronRight size={12} color={colors.textMuted} />}
          sx={{ mb: 0.75, '& .MuiBreadcrumbs-separator': { mx: 0.75 } }}
        >
          {breadcrumbs.map((b, i) => {
            const isCurrent = i === breadcrumbs.length - 1;
            return b.href && !isCurrent ? (
              <Link key={b.label} href={b.href} underline="hover" sx={{ color: colors.textMuted, fontSize: '0.75rem', fontWeight: 500 }}>
                {b.label}
              </Link>
            ) : (
              <Typography key={b.label} sx={{ color: isCurrent ? colors.textSecondary : colors.textMuted, fontSize: '0.75rem', fontWeight: isCurrent ? 550 : 500 }}>
                {b.label}
              </Typography>
            );
          })}
        </Breadcrumbs>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        {Icon && (
          <Box
            sx={{
              width: 34, height: 34, borderRadius: '9px', display: 'grid', placeItems: 'center',
              bgcolor: colors.primarySoft, color: colors.primary, flexShrink: 0,
            }}
          >
            <Icon size={17} strokeWidth={2} />
          </Box>
        )}
        <Box>
          <Typography variant="h2" sx={{ fontSize: { xs: '1.25rem', md: '1.375rem' } }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography sx={{ fontSize: '0.8125rem', color: colors.textSecondary, mt: 0.125 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
    {actions && <Box sx={{ display: 'flex', gap: 1.5, flexShrink: 0 }}>{actions}</Box>}
  </Box>
);

export default PageHeader;
