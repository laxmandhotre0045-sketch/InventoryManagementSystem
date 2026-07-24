import {
  Box, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TablePagination, TableRow, Skeleton, Typography, Divider,
} from '@mui/material';
import EmptyState from '../ui/EmptyState';
import SearchBar from '../ui/SearchBar';
import { colors } from '../../theme/tokens';

// Enterprise-grade data table.
// Backward-compatible: existing props (columns, rows, loading, page, rowsPerPage,
// totalElements, onPageChange, onRowsPerPageChange, emptyMessage, renderActions)
// still work. New optional props: title, search, onSearchChange, toolbarActions,
// emptyState, stickyHeader.
const DataTable = ({
  columns,
  rows,
  rowKey = 'id',
  loading = false,
  page = 0,
  rowsPerPage = 10,
  totalElements = 0,
  onPageChange,
  onRowsPerPageChange,
  emptyMessage = 'No records found',
  renderActions,
  title,
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  toolbarActions,
  emptyState,
  stickyHeader = true,
  minWidth = 720,
}) => {
  const colSpan = columns.length + (renderActions ? 1 : 0);
  const showToolbar = title || onSearchChange || toolbarActions;

  return (
    <Card sx={{ width: '100%', overflow: 'hidden' }}>
      {showToolbar && (
        <>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
              p: 2,
            }}
          >
            {title ? (
              <Typography sx={{ fontSize: '1rem', fontWeight: 600 }}>{title}</Typography>
            ) : (
              <span />
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              {onSearchChange && (
                <SearchBar
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  width={240}
                />
              )}
              {toolbarActions}
            </Box>
          </Box>
          <Divider />
        </>
      )}

      <TableContainer sx={{ maxHeight: stickyHeader ? 620 : 'none' }}>
        <Table stickyHeader={stickyHeader} sx={{ minWidth }}>
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col.field} align={col.align || 'left'} sx={{ whiteSpace: 'nowrap' }}>
                  {col.headerName}
                </TableCell>
              ))}
              {renderActions && (
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  Actions
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`sk-${i}`} hover={false}>
                  {Array.from({ length: colSpan }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton variant="text" width={j === 0 ? '60%' : '80%'} height={22} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow hover={false}>
                <TableCell colSpan={colSpan} sx={{ borderBottom: 0, p: 0 }}>
                  {emptyState ? (
                    <EmptyState {...emptyState} />
                  ) : (
                    <Box sx={{ py: 7, textAlign: 'center' }}>
                      <Typography color="text.secondary">{emptyMessage}</Typography>
                    </Box>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, idx) => (
                <TableRow
                  key={row[rowKey] ?? idx}
                  hover
                  sx={{ '&:nth-of-type(even)': { bgcolor: '#FCFBFA' }, '&:hover': { bgcolor: '#F3F4F6' } }}
                >
                  {columns.map((col) => (
                    <TableCell key={col.field} align={col.align || 'left'}>
                      {col.render ? col.render(row) : (row[col.field] ?? <Box component="span" sx={{ color: colors.textMuted }}>—</Box>)}
                    </TableCell>
                  ))}
                  {renderActions && <TableCell align="right">{renderActions(row)}</TableCell>}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {onPageChange && (
        <>
          <Divider />
          <TablePagination
            component="div"
            count={totalElements}
            page={page}
            onPageChange={(_, p) => onPageChange(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => onRowsPerPageChange(parseInt(e.target.value, 10))}
            rowsPerPageOptions={[5, 10, 25, 50]}
            sx={{ '& .MuiTablePagination-toolbar': { px: 2 } }}
          />
        </>
      )}
    </Card>
  );
};

export default DataTable;
