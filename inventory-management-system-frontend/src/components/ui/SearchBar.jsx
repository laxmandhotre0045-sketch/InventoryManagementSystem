import { InputBase, Box } from '@mui/material';
import { Search } from 'lucide-react';
import { colors } from '../../theme/tokens';

// Reusable rounded search input with a leading icon.
const SearchBar = ({ value, onChange, onKeyDown, placeholder = 'Search…', width = 280, sx, inputProps }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.25,
      px: 1.75,
      height: 46,
      width,
      maxWidth: '100%',
      borderRadius: '11px',
      border: `1px solid ${colors.border}`,
      bgcolor: colors.paper,
      boxShadow: '0 1px 2px rgba(16,24,40,0.03)',
      transition: 'box-shadow .18s ease, border-color .18s ease',
      '&:hover': { borderColor: colors.borderStrong },
      '&:focus-within': { borderColor: colors.primary, boxShadow: `0 0 0 3px ${colors.primarySoft}` },
      ...sx,
    }}
  >
    <Search size={19} color={colors.textMuted} />
    <InputBase
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      inputProps={inputProps}
      sx={{ flex: 1, fontSize: '1rem', '& input::placeholder': { color: colors.textSecondary, opacity: 0.75 } }}
    />
  </Box>
);

export default SearchBar;
