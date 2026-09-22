import { Alert, Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { authApi } from '../api/services';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/feedback';
import { BusyButton, PageHeader, PasswordField } from '../components/ui';

/**
 * Change password lives under the account menu and in the sidebar. Employees are never
 * force-redirected here after signing in; a reminder is shown instead when an administrator
 * has issued a temporary password.
 */
export function ChangePasswordPage() {
  const { user, signOut } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const problem = useMemo(() => {
    if (next.length > 0 && next.length < 8) return 'Use at least 8 characters.';
    if (next.length > 0 && next === current) return 'The new password must be different from the current one.';
    if (confirm.length > 0 && confirm !== next) return 'The two passwords do not match.';
    return null;
  }, [current, next, confirm]);

  const canSubmit = current.length > 0 && next.length >= 8 && next === confirm && next !== current;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const { message } = await authApi.changePassword(current, next, confirm);
      notify(message, 'success');

      // Changing the password revokes every session, so the user signs in again.
      await signOut();
      navigate('/login', { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to change the password right now.');
      setBusy(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 560 }}>
      <PageHeader
        overline="ACCOUNT"
        title="Change password"
        description="Your password is separate from your profile details. Changing it signs you out of every device."
      />

      {user?.mustChangePassword && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          An administrator set a temporary password for your account. Please choose your own now.
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box component="form" onSubmit={submit} noValidate>
            <Stack spacing={2.25}>
              {error && <Alert severity="error">{error}</Alert>}

              <PasswordField
                label="Current password"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
                autoComplete="current-password"
                required
              />

              <PasswordField
                label="New password"
                value={next}
                onChange={(event) => setNext(event.target.value)}
                autoComplete="new-password"
                helperText="At least 8 characters."
                required
              />

              <PasswordField
                label="Confirm new password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
                error={problem !== null && confirm.length > 0}
                helperText={problem ?? ' '}
                required
              />

              <Stack direction="row" spacing={1.5}>
                <BusyButton type="submit" variant="contained" busy={busy} busyLabel="Updating…" disabled={!canSubmit}>
                  Update password
                </BusyButton>
                <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
                  You will be asked to sign in again.
                </Typography>
              </Stack>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
