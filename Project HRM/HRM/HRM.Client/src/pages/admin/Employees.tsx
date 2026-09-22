import {
  Avatar,
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
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import LockResetIcon from '@mui/icons-material/LockReset';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { useState } from 'react';
import { employeeApi } from '../../api/services';
import type { EmployeeListItem } from '../../api/types';
import { ConfirmDialog, DataState, useToast } from '../../components/feedback';
import { BusyButton, PageHeader, PasswordField, StatusChip } from '../../components/ui';
import { useAction, useApi } from '../../hooks/useApi';
import { palette } from '../../theme';
import { formatDate, initials, today } from '../../utils/format';

const emptyEmployee = {
  firstName: '', lastName: '', email: '', userName: '', temporaryPassword: '',
  employeeCode: '', joiningDate: today(), dateOfBirth: '', phone: '',
  department: '', designation: '', location: '', role: 'Employee',
};

export function AdminEmployeesPage() {
  const { notify } = useToast();
  const { busy, run } = useAction();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyEmployee });
  const [resetTarget, setResetTarget] = useState<EmployeeListItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [toToggle, setToToggle] = useState<EmployeeListItem | null>(null);

  const employees = useApi(
    () => employeeApi.list({ search: search || undefined, page: page + 1, pageSize }),
    [search, page, pageSize],
  );

  const create = async () => {
    const result = await run(() =>
      employeeApi.create({
        ...form,
        dateOfBirth: form.dateOfBirth || null,
        phone: form.phone || null,
        department: form.department || null,
        designation: form.designation || null,
        location: form.location || null,
      }),
    );
    if (result) {
      notify(result.message, 'success');
      setCreateOpen(false);
      setForm({ ...emptyEmployee });
      employees.reload();
    }
  };

  const resetPassword = async () => {
    if (!resetTarget) return;
    const result = await run(() => employeeApi.resetPassword(resetTarget.id, newPassword, true));
    if (result) {
      notify(result.message, 'success');
      setResetTarget(null);
      setNewPassword('');
    }
  };

  const toggleActive = async () => {
    if (!toToggle) return;
    const result = await run(() =>
      toToggle.isActive ? employeeApi.deactivate(toToggle.id) : employeeApi.activate(toToggle.id),
    );
    if (result) {
      notify(result.message, 'success');
      setToToggle(null);
      employees.reload();
    }
  };

  return (
    <Box>
      <PageHeader
        overline="PEOPLE"
        title="Employees"
        description="Create accounts, maintain records and reset passwords. Existing passwords can never be read, only replaced."
        action={
          <Button variant="contained" startIcon={<PersonAddIcon />} onClick={() => setCreateOpen(true)}>
            Add employee
          </Button>
        }
      />

      <Card>
        <Stack sx={{ p: 2.5, pb: 1.5 }}>
          <TextField
            label="Search by name, code or email"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            sx={{ maxWidth: 380 }}
          />
        </Stack>

        <Box sx={{ px: 2.5, pb: 1 }}>
          <DataState
            loading={employees.loading}
            error={employees.error}
            data={employees.data?.items}
            onRetry={employees.reload}
            emptyTitle="No employees found"
            emptyDescription={search ? 'No one matches that search.' : 'Add your first employee to get started.'}
          >
            {(items) => (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Employee</TableCell>
                      <TableCell>Department</TableCell>
                      <TableCell>Joined</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((employee) => (
                      <TableRow key={employee.id} hover>
                        <TableCell>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Avatar
                              src={employee.profileImageUrl ?? undefined}
                              sx={{ width: 34, height: 34, background: palette.purple, fontSize: 13 }}
                            >
                              {initials(employee.fullName)}
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="body2" fontWeight={600} noWrap>
                                {employee.fullName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" noWrap>
                                {employee.employeeCode} · {employee.email}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{employee.department ?? '—'}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {employee.designation ?? '—'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(employee.joiningDate)}</TableCell>
                        <TableCell>{employee.role}</TableCell>
                        <TableCell>
                          <StatusChip status={employee.isActive ? employee.employmentStatus : 'Resigned'} />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Button size="small" startIcon={<LockResetIcon />} onClick={() => setResetTarget(employee)}>
                              Reset password
                            </Button>
                            <Button
                              size="small"
                              color={employee.isActive ? 'error' : 'success'}
                              onClick={() => setToToggle(employee)}
                            >
                              {employee.isActive ? 'Deactivate' : 'Activate'}
                            </Button>
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

        {(employees.data?.totalCount ?? 0) > 0 && (
          <TablePagination
            component="div"
            count={employees.data?.totalCount ?? 0}
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

      <Dialog open={createOpen} onClose={busy ? undefined : () => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add employee</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            {[
              { key: 'firstName', label: 'First name', required: true },
              { key: 'lastName', label: 'Last name', required: true },
              { key: 'email', label: 'Work email', required: true, type: 'email' },
              { key: 'userName', label: 'Username', required: true },
              { key: 'employeeCode', label: 'Employee code', required: true },
              { key: 'phone', label: 'Phone' },
              { key: 'department', label: 'Department' },
              { key: 'designation', label: 'Designation' },
              { key: 'location', label: 'Location' },
            ].map((field) => (
              <Grid key={field.key} size={{ xs: 12, sm: 6 }}>
                <TextField
                  label={field.label}
                  type={field.type ?? 'text'}
                  required={field.required}
                  value={form[field.key as keyof typeof form]}
                  onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                />
              </Grid>
            ))}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Joining date"
                type="date"
                value={form.joiningDate}
                onChange={(event) => setForm({ ...form, joiningDate: event.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Date of birth"
                type="date"
                value={form.dateOfBirth}
                onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                label="Role"
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value })}
              >
                <MenuItem value="Employee">Employee</MenuItem>
                <MenuItem value="Admin">Administrator</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <PasswordField
                label="Temporary password"
                value={form.temporaryPassword}
                onChange={(event) => setForm({ ...form, temporaryPassword: event.target.value })}
                helperText="At least 8 characters. The employee is prompted to change it."
                required
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setCreateOpen(false)} disabled={busy} color="inherit">
            Cancel
          </Button>
          <BusyButton
            variant="contained"
            busy={busy}
            busyLabel="Creating…"
            onClick={create}
            disabled={
              !form.firstName || !form.lastName || !form.email || !form.userName ||
              !form.employeeCode || form.temporaryPassword.length < 8
            }
          >
            Create employee
          </BusyButton>
        </DialogActions>
      </Dialog>

      <Dialog open={resetTarget !== null} onClose={busy ? undefined : () => setResetTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Reset password</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Set a new password for {resetTarget?.fullName}. You cannot view their existing password.
            All their sessions will end and they will be asked to choose their own password.
          </Typography>
          <PasswordField
            label="New password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            helperText="At least 8 characters. Share it over a secure channel."
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setResetTarget(null)} disabled={busy} color="inherit">
            Cancel
          </Button>
          <BusyButton
            variant="contained"
            busy={busy}
            busyLabel="Resetting…"
            onClick={resetPassword}
            disabled={newPassword.length < 8}
          >
            Reset password
          </BusyButton>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={toToggle !== null}
        title={toToggle?.isActive ? 'Deactivate this employee?' : 'Reactivate this employee?'}
        message={
          toToggle?.isActive
            ? `${toToggle.fullName} will not be able to sign in. Their leave history and records are kept.`
            : `${toToggle?.fullName} will be able to sign in again.`
        }
        confirmLabel={toToggle?.isActive ? 'Deactivate' : 'Activate'}
        confirmColor={toToggle?.isActive ? 'error' : 'success'}
        busy={busy}
        onConfirm={toggleActive}
        onClose={() => setToToggle(null)}
      />
    </Box>
  );
}
