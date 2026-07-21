import {
  Box, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TablePagination, TableRow, CircularProgress, Typography,
} from '@mui/material';

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
}) => (
  <Paper sx={{ width: '100%', overflow: 'hidden' }}>
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'grey.50' }}>
            {columns.map((col) => (
              <TableCell key={col.field} sx={{ fontWeight: 600 }}>{col.headerName}</TableCell>
            ))}
            {renderActions && <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={columns.length + (renderActions ? 1 : 0)} align="center" sx={{ py: 6 }}>
                <CircularProgress size={32} />
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + (renderActions ? 1 : 0)} align="center" sx={{ py: 6 }}>
                <Typography color="text.secondary">{emptyMessage}</Typography>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row[rowKey]} hover>
                {columns.map((col) => (
                  <TableCell key={col.field}>
                    {col.render ? col.render(row) : row[col.field]}
                  </TableCell>
                ))}
                {renderActions && (
                  <TableCell align="right">{renderActions(row)}</TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
    {onPageChange && (
      <TablePagination
        component="div"
        count={totalElements}
        page={page}
        onPageChange={(_, p) => onPageChange(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => onRowsPerPageChange(parseInt(e.target.value, 10))}
        rowsPerPageOptions={[5, 10, 25]}
      />
    )}
  </Paper>
);

export default DataTable;
