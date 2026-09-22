import {
  Box,
  Button,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import CakeIcon from '@mui/icons-material/Cake';
import CelebrationIcon from '@mui/icons-material/Celebration';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import GroupIcon from '@mui/icons-material/Group';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../api/services';
import { ErrorState, LoadingState } from '../components/feedback';
import { PageHeader, SectionCard, StatCard, StatusChip } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../auth/AuthContext';
import { palette } from '../theme';
import { formatDate, formatDays } from '../utils/format';

/** Every figure here comes from /api/dashboard/admin. Nothing is hard-coded. */
export function AdminDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi(() => dashboardApi.admin());

  if (loading) return <LoadingState rows={6} label="Loading the dashboard" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const maxDays = Math.max(...data.leaveUsageByType.map((x) => x.approvedDays), 1);

  return (
    <Box>
      <PageHeader
        overline="WORKSPACE"
        title={`Good day, ${user?.fullName ?? 'there'}`}
        description="A live view of your people, leave and pending approvals."
      />

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Total employees"
            value={data.totalEmployees}
            caption={`${data.activeEmployees} active`}
            icon={<GroupIcon />}
            tone="purple"
            onClick={() => navigate('/admin/employees')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard label="On leave today" value={data.onLeaveToday} icon={<EventBusyIcon />} tone="warning" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Pending requests"
            value={data.pendingLeaveRequests}
            caption="Awaiting your review"
            icon={<PendingActionsIcon />}
            tone={data.pendingLeaveRequests > 0 ? 'danger' : 'default'}
            onClick={() => navigate('/admin/leave-requests')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Approved this month"
            value={data.approvedThisMonth}
            icon={<FactCheckIcon />}
            tone="success"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Upcoming birthdays"
            value={data.upcomingBirthdays}
            caption="Next 30 days"
            icon={<CakeIcon />}
            onClick={() => navigate('/calendar')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Work anniversaries"
            value={data.upcomingAnniversaries}
            caption="Next 30 days"
            icon={<CelebrationIcon />}
            onClick={() => navigate('/calendar')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Pending reimbursements"
            value={data.pendingReimbursements}
            icon={<ReceiptLongIcon />}
            onClick={() => navigate('/reimbursements')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Pending referrals"
            value={data.pendingReferrals}
            icon={<AssignmentIndIcon />}
            onClick={() => navigate('/referrals')}
          />
        </Grid>

        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard
            title="Recent leave activity"
            action={
              <Button size="small" onClick={() => navigate('/admin/leave-requests')}>
                View all
              </Button>
            }
            dense
          >
            {data.recentRequests.length === 0 ? (
              <Typography color="text.secondary" variant="body2" sx={{ px: 2.75, pb: 2.5 }}>
                No leave requests have been submitted yet.
              </Typography>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Employee</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Dates</TableCell>
                      <TableCell align="right">Days</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.recentRequests.map((request) => (
                      <TableRow key={request.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {request.employeeName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {request.employeeCode}
                          </Typography>
                        </TableCell>
                        <TableCell>{request.leaveTypeCode}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {formatDate(request.fromDate)}
                          {request.fromDate !== request.toDate && ` – ${formatDate(request.toDate)}`}
                        </TableCell>
                        <TableCell align="right">{formatDays(request.days)}</TableCell>
                        <TableCell>
                          <StatusChip status={request.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard title="Approved leave by type" description={`Calendar year ${new Date().getFullYear()}`}>
            {data.leaveUsageByType.length === 0 ? (
              <Typography color="text.secondary" variant="body2">
                No leave has been approved yet this year.
              </Typography>
            ) : (
              <Stack spacing={2.25} sx={{ mt: 1 }}>
                {data.leaveUsageByType.map((usage) => (
                  <Box key={usage.code}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {usage.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatDays(usage.approvedDays)} days · {usage.requestCount} request
                        {usage.requestCount === 1 ? '' : 's'}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={(usage.approvedDays / maxDays) * 100}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        background: palette.line,
                        '& .MuiLinearProgress-bar': { borderRadius: 4 },
                      }}
                    />
                  </Box>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  );
}
