import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import PaymentsIcon from '@mui/icons-material/Payments';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import WorkHistoryIcon from '@mui/icons-material/WorkHistory';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../api/services';
import { ErrorState, LoadingState } from '../components/feedback';
import { EventChip, PageHeader, SectionCard, StatusChip } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { palette } from '../theme';
import { formatDate, formatDayMonth, formatDays, formatDuration, initials } from '../utils/format';

export function EmployeeDashboardPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi(() => dashboardApi.employee());

  if (loading) return <LoadingState rows={6} label="Loading your dashboard" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <Box>
      <PageHeader
        overline="MY WORKSPACE"
        title={`Good day, ${data.fullName}`}
        description="Your leave balances, recent requests and what is coming up across the company."
        action={
          <Button variant="contained" startIcon={<EventAvailableIcon />} onClick={() => navigate('/employee/leave/apply')}>
            Apply for leave
          </Button>
        }
      />

      <Grid container spacing={2.5}>
        <Grid size={12}>
          <Card>
            <CardContent>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2.5}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                justifyContent="space-between"
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar
                    src={data.profileImageUrl ?? undefined}
                    sx={{ width: 58, height: 58, background: palette.purple, fontSize: 20, fontWeight: 700 }}
                  >
                    {initials(data.fullName)}
                  </Avatar>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Time with the company
                    </Typography>
                    <Typography variant="h5">{formatDuration(data.workingDuration)}</Typography>
                  </Box>
                </Stack>

                <Stack direction="row" spacing={4}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Working days
                    </Typography>
                    <Typography variant="h5">{data.workingDuration.totalWorkingDays.toLocaleString()}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Calendar days
                    </Typography>
                    <Typography variant="h5">{data.workingDuration.totalCalendarDays.toLocaleString()}</Typography>
                  </Box>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {data.balances.map((balance) => {
          const used = balance.total > 0 ? (balance.taken / balance.total) * 100 : 0;
          return (
            <Grid key={balance.leaveTypeId} size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {balance.name}
                    </Typography>
                    <Typography variant="caption" fontWeight={700} sx={{ color: palette.purple }}>
                      {balance.code}
                    </Typography>
                  </Stack>

                  <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ mt: 1 }}>
                    <Typography variant="h2" sx={{ fontSize: 32 }}>
                      {formatDays(balance.remaining)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      / {formatDays(balance.total)}
                    </Typography>
                  </Stack>

                  <LinearProgress
                    variant="determinate"
                    value={Math.min(used, 100)}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      my: 1.25,
                      background: palette.line,
                      '& .MuiLinearProgress-bar': { borderRadius: 3 },
                    }}
                  />

                  <Typography variant="caption" color="text.secondary">
                    {formatDays(balance.taken)} taken
                    {balance.pending > 0 && ` · ${formatDays(balance.pending)} pending`}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}

        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard
            title="My recent requests"
            action={
              <Button size="small" onClick={() => navigate('/employee/leave/history')}>
                View all
              </Button>
            }
          >
            {data.recentRequests.length === 0 ? (
              <Typography color="text.secondary" variant="body2">
                You have not applied for any leave yet.
              </Typography>
            ) : (
              <Stack divider={<Box sx={{ borderBottom: `1px solid ${palette.line}` }} />}>
                {data.recentRequests.map((request) => (
                  <Stack
                    key={request.id}
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    spacing={1}
                    sx={{ py: 1.35 }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {request.leaveTypeName} · {formatDays(request.days)} day
                        {request.days === 1 ? '' : 's'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(request.fromDate)}
                        {request.fromDate !== request.toDate && ` – ${formatDate(request.toDate)}`}
                      </Typography>
                    </Box>
                    <StatusChip status={request.status} />
                  </Stack>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard
            title="Coming up"
            description="Next 30 days"
            action={
              <Button size="small" onClick={() => navigate('/calendar')}>
                Calendar
              </Button>
            }
          >
            {data.upcomingEvents.length === 0 ? (
              <Typography color="text.secondary" variant="body2">
                Nothing scheduled in the next 30 days.
              </Typography>
            ) : (
              <Stack spacing={1.25}>
                {data.upcomingEvents.map((event) => (
                  <Stack key={event.id} direction="row" spacing={1.5} alignItems="center">
                    <Box
                      sx={{
                        width: 46,
                        textAlign: 'center',
                        flexShrink: 0,
                        py: 0.5,
                        borderRadius: 2,
                        background: palette.canvas,
                      }}
                    >
                      <Typography variant="caption" fontWeight={700}>
                        {formatDayMonth(event.start)}
                      </Typography>
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {event.title}
                      </Typography>
                    </Box>
                    <EventChip type={event.type} />
                  </Stack>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard
            title="Company planning"
            description="Upcoming releases and events"
            action={
              <Button size="small" onClick={() => navigate('/company-planning')}>
                View plan
              </Button>
            }
          >
            {data.upcomingPlanning.length === 0 ? (
              <Typography color="text.secondary" variant="body2">
                No planning events are scheduled.
              </Typography>
            ) : (
              <Stack spacing={1.25}>
                {data.upcomingPlanning.map((event) => (
                  <Stack key={event.id} direction="row" spacing={1.5} alignItems="center">
                    <Box
                      sx={{
                        width: 46,
                        textAlign: 'center',
                        flexShrink: 0,
                        py: 0.5,
                        borderRadius: 2,
                        background: palette.canvas,
                      }}
                    >
                      <Typography variant="caption" fontWeight={700}>
                        {formatDayMonth(event.startDate)}
                      </Typography>
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {event.title}
                      </Typography>
                    </Box>
                    <EventChip type={event.type} />
                  </Stack>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard title="Quick actions">
            <Grid container spacing={1.5}>
              {[
                { label: 'Apply for leave', icon: <EventAvailableIcon />, to: '/employee/leave/apply' },
                { label: 'Common calendar', icon: <CalendarMonthIcon />, to: '/calendar' },
                { label: 'Salary slips', icon: <PaymentsIcon />, to: '/salary-slips' },
                { label: 'Reimbursements', icon: <ReceiptLongIcon />, to: '/reimbursements' },
                { label: 'My profile', icon: <WorkHistoryIcon />, to: '/profile' },
              ].map((action) => (
                <Grid key={action.to} size={{ xs: 12, sm: 6 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={action.icon}
                    onClick={() => navigate(action.to)}
                    sx={{ justifyContent: 'flex-start', py: 1.25, borderColor: palette.line, color: palette.ink }}
                  >
                    {action.label}
                  </Button>
                </Grid>
              ))}
            </Grid>
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  );
}
