import {
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DoDisturbIcon from '@mui/icons-material/DoDisturb';
import { useState } from 'react';
import { leaveApi } from '../../api/services';
import type { LeaveRequest } from '../../api/types';
import { DataState, useToast } from '../../components/feedback';
import { BusyButton, PageHeader, StatusChip } from '../../components/ui';
import { useAction, useApi } from '../../hooks/useApi';
import { formatDate, formatDateTime, formatDays } from '../../utils/format';

type ReviewAction = 'approve' | 'reject' | 'cancel';

const actionCopy: Record<ReviewAction, { title: string; verb: string; colour: 'success' | 'error' | 'warning'; note: string }> = {
  approve: {
    title: 'Approve leave',
    verb: 'Approve',
    colour: 'success',
    note: 'The days are deducted from the balance and an email goes to everyone.',
  },
  reject: {
    title: 'Reject leave',
    verb: 'Reject',
    colour: 'error',
    note: 'No balance is deducted. The employee is notified in the app.',
  },
  cancel: {
    title: 'Cancel approved leave',
    verb: 'Cancel leave',
    colour: 'warning',
    note: 'The deducted days are returned to the employee’s balance.',
  },
};

export function AdminLeaveRequestsPage() {
  const { notify } = useToast();
  const { busy, run } = useAction();

  const [status, setStatus] = useState('Pending');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [review, setReview] = useState<{ request: LeaveRequest; action: ReviewAction } | null>(null);
  const [comment, setComment] = useState('');

  const requests = useApi(
    () => leaveApi.history({ status: status || undefined, page: page + 1, pageSize }),
    [status, page, pageSize],
  );

  const openReview = (request: LeaveRequest, action: ReviewAction) => {
    setReview({ request, action });
    setComment('');
  };

  const submitReview = async () => {
    if (!review) return;

    const { request, action } = review;
    const call =
      action === 'approve'
        ? () => leaveApi.approve(request.id, comment || undefined)
        : action === 'reject'
          ? () => leaveApi.reject(request.id, comment || undefined)
          : () => leaveApi.cancel(request.id, comment || undefined);

    const result = await run(call);
    if (result) {
      notify(result.message, 'success');
      setReview(null);
      requests.reload();
    } else {
      // The action failed; close the dialog so the refreshed list shows the real state.
      setReview(null);
      requests.reload();
      notify('That request could not be updated. The list has been refreshed.', 'error');
    }
  };

  return (
    <Box>
      <PageHeader
        overline="LEAVE"
        title="Leave requests"
        description="Approve, reject or cancel employee leave. Balances are updated in the same transaction."
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
            {['Pending', 'Approved', 'Rejected', 'Cancelled', 'Withdrawn'].map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Box sx={{ px: 2.5, pb: 1 }}>
          <DataState
            loading={requests.loading}
            error={requests.error}
            data={requests.data?.items}
            onRetry={requests.reload}
            emptyTitle="No leave requests found"
            emptyDescription={
              status === 'Pending'
                ? 'There is nothing waiting for your review.'
                : 'No requests match the selected status.'
            }
          >
            {(items) => (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Employee</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Dates</TableCell>
                      <TableCell align="right">Days</TableCell>
                      <TableCell>Reason</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((request) => (
                      <TableRow key={request.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {request.employeeName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {request.employeeCode} · applied {formatDateTime(request.appliedAtUtc)}
                          </Typography>
                        </TableCell>
                        <TableCell>{request.leaveTypeCode}</TableCell>
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
                        <TableCell sx={{ maxWidth: 220 }}>
                          <Tooltip title={request.reason}>
                            <Typography variant="body2" noWrap>
                              {request.reason}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <StatusChip status={request.status} />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            {request.status === 'Pending' && (
                              <>
                                <Button
                                  size="small"
                                  color="success"
                                  startIcon={<CheckCircleIcon />}
                                  onClick={() => openReview(request, 'approve')}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="small"
                                  color="error"
                                  startIcon={<DoDisturbIcon />}
                                  onClick={() => openReview(request, 'reject')}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                            {request.status === 'Approved' && (
                              <Button
                                size="small"
                                color="warning"
                                startIcon={<CancelIcon />}
                                onClick={() => openReview(request, 'cancel')}
                              >
                                Cancel
                              </Button>
                            )}
                            {!['Pending', 'Approved'].includes(request.status) && (
                              <Typography variant="caption" color="text.secondary">
                                No action available
                              </Typography>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </DataState>
        </Box>

        {(requests.data?.totalCount ?? 0) > 0 && (
          <TablePagination
            component="div"
            count={requests.data?.totalCount ?? 0}
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

      <Dialog open={review !== null} onClose={busy ? undefined : () => setReview(null)} maxWidth="xs" fullWidth>
        {review && (
          <>
            <DialogTitle>{actionCopy[review.action].title}</DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {review.request.employeeName} · {review.request.leaveTypeCode} ·{' '}
                {formatDays(review.request.days)} day
                {review.request.days === 1 ? '' : 's'} from {formatDate(review.request.fromDate)}
              </Typography>

              <TextField
                label="Comment (optional)"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                multiline
                minRows={2}
                slotProps={{ htmlInput: { maxLength: 500 } }}
              />

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                {actionCopy[review.action].note}
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5 }}>
              <Button onClick={() => setReview(null)} disabled={busy} color="inherit">
                Cancel
              </Button>
              <BusyButton
                variant="contained"
                color={actionCopy[review.action].colour}
                busy={busy}
                busyLabel={`${actionCopy[review.action].verb.replace(/e$/, '')}ing…`}
                onClick={submitReview}
              >
                {actionCopy[review.action].verb}
              </BusyButton>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
