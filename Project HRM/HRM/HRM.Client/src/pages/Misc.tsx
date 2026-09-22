import {
  Box,
  Button,
  Card,
  CardContent,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import LockResetIcon from '@mui/icons-material/LockReset';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { auditApi } from '../api/services';
import { DataState } from '../components/feedback';
import { PageHeader, SectionCard } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../auth/AuthContext';
import { palette } from '../theme';
import { formatDateTime } from '../utils/format';

/** Administrator view of the audit trail. */
export function AuditLogsPage() {
  const [module, setModule] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const modules = useApi(() => auditApi.modules());
  const logs = useApi(
    () => auditApi.list({ module: module || undefined, page: page + 1, pageSize }),
    [module, page, pageSize],
  );

  return (
    <Box>
      <PageHeader
        overline="ADMINISTRATION"
        title="Audit log"
        description="A record of sign-ins, leave decisions, password resets and other significant actions. Passwords and tokens are never recorded."
      />

      <Card>
        <Stack sx={{ p: 2.5, pb: 1.5 }}>
          <TextField
            select
            label="Module"
            value={module}
            onChange={(event) => {
              setModule(event.target.value);
              setPage(0);
            }}
            sx={{ maxWidth: 240 }}
          >
            <MenuItem value="">All modules</MenuItem>
            {(modules.data ?? []).map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Box sx={{ px: 2.5, pb: 1 }}>
          <DataState
            loading={logs.loading}
            error={logs.error}
            data={logs.data?.items}
            onRetry={logs.reload}
            emptyTitle="No audit entries"
            emptyDescription="Nothing has been recorded for this filter yet."
          >
            {(items) => (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>When</TableCell>
                      <TableCell>User</TableCell>
                      <TableCell>Module</TableCell>
                      <TableCell>Action</TableCell>
                      <TableCell>Reference</TableCell>
                      <TableCell>Details</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((entry) => (
                      <TableRow key={entry.id} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(entry.createdAtUtc)}</TableCell>
                        <TableCell>{entry.userName}</TableCell>
                        <TableCell>{entry.module}</TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {entry.action}
                          </Typography>
                        </TableCell>
                        <TableCell>{entry.entityId}</TableCell>
                        <TableCell sx={{ maxWidth: 280 }}>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {entry.details ?? '—'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </DataState>
        </Box>

        {(logs.data?.totalCount ?? 0) > 0 && (
          <TablePagination
            component="div"
            count={logs.data?.totalCount ?? 0}
            page={page}
            onPageChange={(_, value) => setPage(value)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(0);
            }}
            rowsPerPageOptions={[25, 50, 100]}
          />
        )}
      </Card>
    </Box>
  );
}

/** Account settings: the small number of things a signed-in user can change about themselves. */
export function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <Box sx={{ maxWidth: 760 }}>
      <PageHeader overline="ACCOUNT" title="Settings" description="Your account and security options." />

      <Grid container spacing={2.5}>
        <Grid size={12}>
          <SectionCard title="Account">
            <Grid container spacing={2.5}>
              {[
                { label: 'Name', value: user?.fullName ?? '—' },
                { label: 'Email', value: user?.email ?? '—' },
                { label: 'Username', value: user?.userName ?? '—' },
                { label: 'Role', value: user?.role ?? '—' },
              ].map((field) => (
                <Grid key={field.label} size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    {field.label}
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {field.value}
                  </Typography>
                </Grid>
              ))}
            </Grid>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <PersonOutlineIcon sx={{ color: palette.purple }} />
              <Typography variant="h6" sx={{ mt: 1 }}>
                Profile details
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Update your name, phone, location and date of birth.
              </Typography>
              <Button variant="outlined" onClick={() => navigate('/profile')}>
                Open profile
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <LockResetIcon sx={{ color: palette.purple }} />
              <Typography variant="h6" sx={{ mt: 1 }}>
                Password
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Change your password. This signs you out of every device.
              </Typography>
              <Button variant="outlined" onClick={() => navigate('/change-password')}>
                Change password
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

/** Shown for any route that does not exist. */
export function NotFoundPage() {
  const { user } = useAuth();
  const home = user?.role === 'Admin' ? '/admin/dashboard' : '/employee/dashboard';

  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh', textAlign: 'center', px: 2 }}>
      <Box>
        <Typography variant="h1" sx={{ color: palette.purple, fontSize: 72 }}>
          404
        </Typography>
        <Typography variant="h4" sx={{ mt: 1 }}>
          That page does not exist
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
          The link may be out of date, or the page may have moved.
        </Typography>
        <Button component={RouterLink} to={home} variant="contained">
          Back to dashboard
        </Button>
      </Box>
    </Box>
  );
}
