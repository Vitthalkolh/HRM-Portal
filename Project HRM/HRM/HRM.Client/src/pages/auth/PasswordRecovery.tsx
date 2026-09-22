import { Alert, Box, Card, Link, Stack, TextField, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import { useMemo, useState, type FormEvent } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { authApi } from '../../api/services';
import { BusyButton, PasswordField } from '../../components/ui';
import { palette } from '../../theme';
import { AuthShell } from './AuthShell';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await authApi.forgotPassword(email.trim());
      // The same confirmation appears whether or not the address exists, so this page
      // cannot be used to discover which addresses are registered.
      setSent(true);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to send the reset email right now.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <Card sx={{ p: { xs: 3, sm: 5 }, width: '100%' }}>
        {sent ? (
          <Stack spacing={2} alignItems="flex-start">
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                background: '#e4f6f1',
                color: palette.success,
              }}
            >
              <MarkEmailReadIcon />
            </Box>
            <Typography variant="h4">Check your email</Typography>
            <Typography color="text.secondary">
              If an account exists for <strong>{email}</strong>, we have sent a link to reset the
              password. The link expires in one hour and can be used once.
            </Typography>
            <Link component={RouterLink} to="/login" underline="hover" sx={{ display: 'inline-flex', gap: 0.5 }}>
              <ArrowBackIcon fontSize="small" /> Back to sign in
            </Link>
          </Stack>
        ) : (
          <>
            <Typography variant="overline" color="primary">
              PASSWORD HELP
            </Typography>
            <Typography variant="h3" sx={{ mt: 0.5 }}>
              Forgot password
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Enter your work email address and we will send you a reset link.
            </Typography>

            <Box component="form" onSubmit={submit} noValidate sx={{ mt: 3 }}>
              <Stack spacing={2}>
                {error && <Alert severity="error">{error}</Alert>}

                <TextField
                  label="Work email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  autoFocus
                  required
                  size="medium"
                />

                <BusyButton
                  type="submit"
                  variant="contained"
                  size="large"
                  busy={busy}
                  busyLabel="Sending…"
                  disabled={!email.includes('@')}
                  fullWidth
                >
                  Send reset link
                </BusyButton>

                <Link
                  component={RouterLink}
                  to="/login"
                  underline="hover"
                  variant="body2"
                  sx={{ display: 'inline-flex', gap: 0.5, alignSelf: 'center' }}
                >
                  <ArrowBackIcon fontSize="small" /> Back to sign in
                </Link>
              </Stack>
            </Box>
          </>
        )}
      </Card>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const problem = useMemo(() => {
    if (password.length > 0 && password.length < 8) return 'Use at least 8 characters.';
    if (confirm.length > 0 && confirm !== password) return 'The two passwords do not match.';
    return null;
  }, [password, confirm]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await authApi.resetPassword(token, password, confirm);
      navigate('/login', {
        replace: true,
        state: { from: undefined },
      });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to reset the password right now.');
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <Card sx={{ p: { xs: 3, sm: 5 }, width: '100%' }}>
        <Typography variant="overline" color="primary">
          PASSWORD HELP
        </Typography>
        <Typography variant="h3" sx={{ mt: 0.5 }}>
          Choose a new password
        </Typography>

        {token.length === 0 ? (
          <Stack spacing={2} sx={{ mt: 3 }}>
            <Alert severity="warning">
              This page needs the reset link from your email. Open the link in that message, or
              request a new one.
            </Alert>
            <Link component={RouterLink} to="/forgot-password" underline="hover">
              Request a new reset link
            </Link>
          </Stack>
        ) : (
          <Box component="form" onSubmit={submit} noValidate sx={{ mt: 3 }}>
            <Stack spacing={2}>
              {error && <Alert severity="error">{error}</Alert>}

              <PasswordField
                label="New password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                helperText="At least 8 characters."
                required
                size="medium"
              />

              <PasswordField
                label="Confirm new password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
                error={confirm.length > 0 && confirm !== password}
                helperText={problem ?? ' '}
                required
                size="medium"
              />

              <BusyButton
                type="submit"
                variant="contained"
                size="large"
                busy={busy}
                busyLabel="Updating…"
                disabled={password.length < 8 || password !== confirm}
                fullWidth
              >
                Update password
              </BusyButton>

              <Link
                component={RouterLink}
                to="/login"
                underline="hover"
                variant="body2"
                sx={{ display: 'inline-flex', gap: 0.5, alignSelf: 'center' }}
              >
                <ArrowBackIcon fontSize="small" /> Back to sign in
              </Link>
            </Stack>
          </Box>
        )}
      </Card>
    </AuthShell>
  );
}
