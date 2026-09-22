import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import LockResetIcon from '@mui/icons-material/LockReset';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import { useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { employeeApi } from '../api/services';
import { ConfirmDialog, ErrorState, LoadingState, useToast } from '../components/feedback';
import { BusyButton, PageHeader, SectionCard, StatusChip } from '../components/ui';
import { useAction, useApi } from '../hooks/useApi';
import { useAuth } from '../auth/AuthContext';
import { palette } from '../theme';
import { formatDate, formatDuration, initials } from '../utils/format';

/** Profile view and edit. Credentials are handled separately on the change-password page. */
export function ProfilePage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { refreshUser } = useAuth();
  const { busy, run } = useAction();

  const profile = useApi(() => employeeApi.me());
  const fileInput = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', location: '', dateOfBirth: '' });
  const [confirmRemove, setConfirmRemove] = useState(false);
  // Cache-busting suffix so a replaced photo is not served from the browser cache.
  const [imageVersion, setImageVersion] = useState(0);

  if (profile.loading) return <LoadingState rows={6} label="Loading your profile" />;
  if (profile.error) return <ErrorState message={profile.error} onRetry={profile.reload} />;
  if (!profile.data) return null;

  const employee = profile.data;

  const startEditing = () => {
    setForm({
      firstName: employee.firstName,
      lastName: employee.lastName,
      phone: employee.phone ?? '',
      location: employee.location ?? '',
      dateOfBirth: employee.dateOfBirth ?? '',
    });
    setEditing(true);
  };

  const save = async () => {
    const result = await run(() =>
      employeeApi.updateMe({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || null,
        location: form.location.trim() || null,
        dateOfBirth: form.dateOfBirth || null,
      }),
    );

    if (result) {
      notify(result.message, 'success');
      setEditing(false);
      profile.setData(result.data);
      void refreshUser();
    }
  };

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset the input so choosing the same file again still fires a change event.
    event.target.value = '';
    if (!file) return;

    const result = await run(() => employeeApi.uploadProfileImage(file));
    if (result) {
      notify(result.message, 'success');
      setImageVersion((value) => value + 1);
      profile.reload();
      void refreshUser();
    }
  };

  const removeImage = async () => {
    const result = await run(() => employeeApi.deleteProfileImage());
    if (result) {
      notify(result.message, 'success');
      setConfirmRemove(false);
      setImageVersion((value) => value + 1);
      profile.reload();
      void refreshUser();
    }
  };

  const imageSrc = employee.profileImageUrl ? `${employee.profileImageUrl}?v=${imageVersion}` : undefined;

  return (
    <Box>
      <PageHeader
        overline="ACCOUNT"
        title="My profile"
        description="Your contact details. Employment terms are maintained by your administrator."
        action={
          <Button variant="outlined" startIcon={<LockResetIcon />} onClick={() => navigate('/change-password')}>
            Change password
          </Button>
        }
      />

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Avatar
                src={imageSrc}
                sx={{
                  width: 116,
                  height: 116,
                  mx: 'auto',
                  mb: 2,
                  background: palette.purple,
                  fontSize: 38,
                  fontWeight: 700,
                }}
              >
                {initials(employee.fullName)}
              </Avatar>

              <Typography variant="h5">{employee.fullName}</Typography>
              <Typography color="text.secondary" variant="body2">
                {employee.designation ?? 'Team member'}
              </Typography>
              <Typography color="text.secondary" variant="caption" display="block" sx={{ mt: 0.5 }}>
                {employee.employeeCode} · {employee.department ?? 'No department'}
              </Typography>

              <Box sx={{ mt: 1.5 }}>
                <StatusChip status={employee.employmentStatus} />
              </Box>

              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={uploadImage}
                hidden
              />

              <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2.5 }}>
                <BusyButton
                  busy={busy}
                  variant="contained"
                  size="small"
                  startIcon={<PhotoCameraIcon />}
                  onClick={() => fileInput.current?.click()}
                >
                  {employee.profileImageUrl ? 'Replace' : 'Add photo'}
                </BusyButton>
                {employee.profileImageUrl && (
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteOutlineIcon />}
                    onClick={() => setConfirmRemove(true)}
                    disabled={busy}
                  >
                    Remove
                  </Button>
                )}
              </Stack>

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                JPG, PNG or WebP · at least 300×300 · up to 2 MB
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ mt: 2.5 }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Time with the company
              </Typography>
              <Typography variant="h5" sx={{ mt: 0.5 }}>
                {formatDuration(employee.workingDuration)}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Stack spacing={1.25}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Joined
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {formatDate(employee.joiningDate)}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Working days
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {employee.workingDuration.totalWorkingDays.toLocaleString()}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Calendar days
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {employee.workingDuration.totalCalendarDays.toLocaleString()}
                  </Typography>
                </Stack>
              </Stack>

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                Working days count Monday to Friday from your joining date to today, excluding
                national holidays.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <SectionCard
            title="Personal details"
            action={
              editing ? undefined : (
                <Button size="small" startIcon={<EditIcon />} onClick={startEditing}>
                  Edit
                </Button>
              )
            }
          >
            {editing ? (
              <Stack spacing={2}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="First name"
                      value={form.firstName}
                      onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                      required
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Last name"
                      value={form.lastName}
                      onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                      required
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Phone"
                      value={form.phone}
                      onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Location"
                      value={form.location}
                      onChange={(event) => setForm({ ...form, location: event.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Date of birth"
                      type="date"
                      value={form.dateOfBirth}
                      onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })}
                      slotProps={{ inputLabel: { shrink: true } }}
                      helperText="Used for birthday greetings on the common calendar."
                    />
                  </Grid>
                </Grid>

                <Alert severity="info">
                  Your email, username, role, employee code and joining date are managed by your
                  administrator.
                </Alert>

                <Stack direction="row" spacing={1.5}>
                  <BusyButton
                    variant="contained"
                    busy={busy}
                    busyLabel="Saving…"
                    onClick={save}
                    disabled={form.firstName.trim().length === 0 || form.lastName.trim().length === 0}
                  >
                    Save changes
                  </BusyButton>
                  <Button color="inherit" variant="outlined" onClick={() => setEditing(false)} disabled={busy}>
                    Cancel
                  </Button>
                </Stack>
              </Stack>
            ) : (
              <Grid container spacing={2.5}>
                {[
                  { label: 'First name', value: employee.firstName },
                  { label: 'Last name', value: employee.lastName },
                  { label: 'Work email', value: employee.email },
                  { label: 'Username', value: employee.userName },
                  { label: 'Phone', value: employee.phone ?? '—' },
                  { label: 'Location', value: employee.location ?? '—' },
                  { label: 'Date of birth', value: employee.dateOfBirth ? formatDate(employee.dateOfBirth) : '—' },
                  { label: 'Department', value: employee.department ?? '—' },
                  { label: 'Designation', value: employee.designation ?? '—' },
                  { label: 'Employee code', value: employee.employeeCode },
                  { label: 'Joining date', value: formatDate(employee.joiningDate) },
                  { label: 'Role', value: employee.role },
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
            )}
          </SectionCard>
        </Grid>
      </Grid>

      <ConfirmDialog
        open={confirmRemove}
        title="Remove your profile photo?"
        message="Your initials will be shown instead. You can upload a new photo at any time."
        confirmLabel="Remove photo"
        confirmColor="error"
        busy={busy}
        onConfirm={removeImage}
        onClose={() => setConfirmRemove(false)}
      />
    </Box>
  );
}
