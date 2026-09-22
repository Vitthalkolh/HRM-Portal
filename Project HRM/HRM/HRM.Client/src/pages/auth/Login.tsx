import { Alert, Box, Card, Checkbox, FormControlLabel, Link, Stack, TextField, Typography } from '@mui/material';
import { useState, type FormEvent } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { homePathFor, useAuth } from '../../auth/AuthContext';
import { BusyButton, PasswordField } from '../../components/ui';
import { AuthShell } from './AuthShell';

/**
 * The single sign-in page for the whole product. There is deliberately no separate admin or
 * employee login: the destination is chosen from the authenticated user's role.
 */
export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const returnTo = (location.state as { from?: string } | null)?.from;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const user = await signIn(login.trim(), password, rememberMe);
      navigate(returnTo && returnTo !== '/login' ? returnTo : homePathFor(user), { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to sign in right now.');
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <Card sx={{ p: { xs: 3, sm: 5 }, width: '100%' }}>
        <Typography variant="overline" color="primary">
          SECURE SIGN IN
        </Typography>
        <Typography variant="h3" sx={{ mt: 0.5 }}>
          Welcome back
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Sign in with your work email or username.
        </Typography>

        <Box component="form" onSubmit={submit} noValidate sx={{ mt: 3 }}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              label="Email or username"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              autoComplete="username"
              autoFocus
              required
              size="medium"
            />

            <PasswordField
              label="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              size="medium"
            />

            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    size="small"
                  />
                }
                label={<Typography variant="body2">Keep me signed in</Typography>}
              />
              <Link component={RouterLink} to="/forgot-password" underline="hover" variant="body2">
                Forgot password?
              </Link>
            </Stack>

            <BusyButton
              type="submit"
              variant="contained"
              size="large"
              busy={busy}
              busyLabel="Signing in…"
              disabled={login.trim().length === 0 || password.length === 0}
              fullWidth
            >
              Sign in
            </BusyButton>
          </Stack>
        </Box>
      </Card>
    </AuthShell>
  );
}
