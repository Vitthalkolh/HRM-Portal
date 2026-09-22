import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import HealingIcon from '@mui/icons-material/Healing';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import LocalFloristIcon from '@mui/icons-material/LocalFlorist';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import type { ReactNode } from 'react';
import { leaveApi } from '../api/services';
import { DataState } from '../components/feedback';
import { PageHeader } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../auth/AuthContext';
import { palette } from '../theme';
import { formatDays } from '../utils/format';

/** Card styling per leave type, keyed by the server's code. */
const styles: Record<string, { icon: ReactNode; color: string; background: string }> = {
  EL: { icon: <BeachAccessIcon />, color: '#2b6cb0', background: '#e7f0fb' },
  SL: { icon: <HealingIcon />, color: '#d1364a', background: '#fdeaec' },
  CL: { icon: <WbSunnyIcon />, color: '#b7791f', background: '#fff4e0' },
  FL: { icon: <LocalFloristIcon />, color: '#12876f', background: '#e4f6f1' },
  WFH: { icon: <HomeWorkIcon />, color: '#6655e8', background: '#efecff' },
};

/**
 * The five employee leave types and their quotas, shown as cards.
 * Management Leave and National Holiday are company calendar events and never appear here.
 */
export function LeaveTypesPage() {
  const { isAdmin } = useAuth();
  const types = useApi(() => leaveApi.types());
  const balances = useApi(() => leaveApi.balance());

  const balanceFor = (leaveTypeId: number) =>
    balances.data?.find((balance) => balance.leaveTypeId === leaveTypeId);

  return (
    <Box>
      <PageHeader
        overline="LEAVE"
        title="Leave types"
        description="The leave types you can apply for, with the annual entitlement for each."
      />

      <Alert severity="info" sx={{ mb: 3 }}>
        Management Leave and National Holidays are company-wide calendar events. They are not
        leave types, cannot be applied for, and are never deducted from your balance.
      </Alert>

      <DataState
        loading={types.loading}
        error={types.error}
        data={types.data}
        onRetry={types.reload}
        emptyTitle="No leave types configured"
        emptyDescription="An administrator needs to configure the leave types before anyone can apply."
      >
        {(items) => (
          <Grid container spacing={2.5}>
            {items.map((type) => {
              const style = styles[type.code] ?? {
                icon: <BeachAccessIcon />,
                color: palette.muted,
                background: '#eef0f6',
              };
              const balance = balanceFor(type.id);
              const used = balance && balance.total > 0 ? (balance.taken / balance.total) * 100 : 0;

              return (
                <Grid key={type.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 3,
                            display: 'grid',
                            placeItems: 'center',
                            color: style.color,
                            background: style.background,
                          }}
                        >
                          {style.icon}
                        </Box>
                        <Chip
                          label={type.code}
                          size="small"
                          sx={{ color: style.color, background: style.background }}
                        />
                      </Stack>

                      <Typography variant="h5" sx={{ mt: 2 }}>
                        {type.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, minHeight: 40 }}>
                        {type.description}
                      </Typography>

                      <Stack direction="row" alignItems="baseline" spacing={0.75} sx={{ mt: 1.5 }}>
                        <Typography variant="h2" sx={{ fontSize: 38, color: style.color }}>
                          {formatDays(type.annualQuota)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          days per year
                        </Typography>
                      </Stack>

                      {!isAdmin && balance && (
                        <Box sx={{ mt: 1.5 }}>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(used, 100)}
                            sx={{
                              height: 6,
                              borderRadius: 3,
                              background: palette.line,
                              '& .MuiLinearProgress-bar': { borderRadius: 3, background: style.color },
                            }}
                          />
                          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.75 }}>
                            <Typography variant="caption" color="text.secondary">
                              {formatDays(balance.taken)} taken
                              {balance.pending > 0 && `, ${formatDays(balance.pending)} pending`}
                            </Typography>
                            <Typography variant="caption" fontWeight={700}>
                              {formatDays(balance.remaining)} left
                            </Typography>
                          </Stack>
                        </Box>
                      )}

                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                        {type.allowHalfDay ? 'Half days allowed' : 'Full days only'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </DataState>
    </Box>
  );
}
