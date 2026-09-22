import {
  Box,
  Button,
  Card,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import UndoIcon from '@mui/icons-material/Undo';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { leaveApi } from '../api/services';
import type { LeaveRequest } from '../api/types';
import { ConfirmDialog, DataState, useToast } from '../components/feedback';
import { PageHeader, StatusChip } from '../components/ui';
import { useAction, useApi } from '../hooks/useApi';
import { formatDate, formatDateTime, formatDays } from '../utils/format';

const statuses = ['Pending', 'Approved', 'Rejected', 'Cancelled', 'Withdrawn'];

/** An employee's own leave history. Only pending requests can be withdrawn. */
export function LeaveHistoryPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { busy, run } = useAction();

  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [toWithdraw, setToWithdraw] = useState<LeaveRequest | null>(null);

  const history = useApi(
    () => leaveApi.history({ status: status || undefined, page: page + 1, pageSize }),
    [status, page, pageSize],
  );

  const withdraw = async () => {
    if (!toWithdraw) return;
    const result = await run(() => leaveApi.withdraw(toWithdraw.id));
    if (result) {
      notify(result.message, 'success');
      setToWithdraw(null);
      history.reload();
    }
  };

  return (
    <Box>
      <PageHeader
        overline="LEAVE"
        title="My leave history"
        description="Every request you have made. Approved, rejected and cancelled records are read-only."
        action={
          <Button variant="contained" startIcon={<EventAvailableIcon />} onClick={() => navigate('/employee/leave/apply')}>
            Apply for leave
          </Button>
        }
      />

      <Card>
        <Stack direction="row" spacing={2} sx={{ p: 2.5, pb: 1.5 }}>
          <TextField
            select
            label="Status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(0);
            }}
            sx={{ maxWidth: 220 }}
          >
            <MenuItem value="">All statuses</MenuItem>
            {statuses.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Box sx={{ px: 2.5, pb: 1 }}>
          <DataState
            loading={history.loading}
            error={history.error}
            data={history.data?.items}
            onRetry={history.reload}
            emptyTitle="No leave requests found"
            emptyDescription={
              status
                ? `You have no ${status.toLowerCase()} leave requests.`
                : 'When you apply for leave, your requests will appear here.'
            }
            emptyAction={
              <Button variant="contained" onClick={() => navigate('/employee/leave/apply')} sx={{ mt: 1 }}>
                Apply for leave
              </Button>
            }
          >
            {(items) => (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Dates</TableCell>
                      <TableCell align="right">Days</TableCell>
                      <TableCell>Reason</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Reviewed</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((request) => (
                      <TableRow key={request.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {request.leaveTypeCode}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {request.leaveTypeName}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {formatDate(request.fromDate)}
                          {request.fromDate !== request.toDate && ` – ${formatDate(request.toDate)}`}
                          {request.isHalfDay && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {request.halfDaySession}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">{formatDays(request.days)}</TableCell>
                        <TableCell sx={{ maxWidth: 240 }}>
                          <Tooltip title={request.reason}>
                            <Typography variant="body2" noWrap>
                              {request.reason}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <StatusChip status={request.status} />
                          {request.reviewComment && (
                            <Tooltip title={request.reviewComment}>
                              <Typography variant="caption" color="text.secondary" display="block" noWrap sx={{ maxWidth: 160 }}>
                                “{request.reviewComment}”
                              </Typography>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {request.reviewedAtUtc ? (
                            <>
                              <Typography variant="body2">{request.reviewedBy ?? '—'}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatDateTime(request.reviewedAtUtc)}
                              </Typography>
                            </>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              —
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {request.status === 'Pending' ? (
                            <Button size="small" startIcon={<UndoIcon />} onClick={() => setToWithdraw(request)}>
                              Withdraw
                            </Button>
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              View only
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </DataState>
        </Box>

        {(history.data?.totalCount ?? 0) > 0 && (
          <TablePagination
            component="div"
            count={history.data?.totalCount ?? 0}
            page={page}
            onPageChange={(_, value) => setPage(value)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        )}
      </Card>

      <ConfirmDialog
        open={toWithdraw !== null}
        title="Withdraw this request?"
        message={
          toWithdraw
            ? `Your ${toWithdraw.leaveTypeCode} request for ${formatDays(toWithdraw.days)} day(s) from ${formatDate(
                toWithdraw.fromDate,
              )} will be withdrawn. No balance was deducted, so nothing is returned.`
            : ''
        }
        confirmLabel="Withdraw"
        confirmColor="warning"
        busy={busy}
        onConfirm={withdraw}
        onClose={() => setToWithdraw(null)}
      />
    </Box>
  );
}
