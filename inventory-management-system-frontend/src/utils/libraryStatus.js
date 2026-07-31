// Maps Library-specific statuses onto the existing StatusBadge palette keys so the
// Book Management module reuses the same visual language as Inventory without
// introducing new colors. Returns props to spread into <StatusBadge {...} />.

export const issueBadge = (status) => {
  switch (status) {
    case 'ISSUED':
      return { status: 'in_progress', label: 'Issued' };
    case 'RETURNED':
      return { status: 'completed', label: 'Returned' };
    case 'OVERDUE':
      return { status: 'out_of_stock', label: 'Overdue' };
    default:
      return { status: 'default', label: status || '—' };
  }
};

export const bookStatusBadge = (status) => {
  switch (status) {
    case 'ACTIVE':
      return { status: 'active', label: 'Active' };
    case 'INACTIVE':
      return { status: 'cancelled', label: 'Inactive' };
    case 'ARCHIVED':
      return { status: 'cancelled', label: 'Archived' };
    default:
      return { status: 'default', label: status || '—' };
  }
};

export const availabilityBadge = (availability) =>
  availability === 'Available'
    ? { status: 'available', label: 'Available' }
    : { status: 'out_of_stock', label: 'Unavailable' };

// Short, locale-friendly date (e.g. "29 Jul 2026"); blank-safe.
export const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
