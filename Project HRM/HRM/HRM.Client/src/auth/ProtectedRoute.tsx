import { Box, CircularProgress } from '@mui/material';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, homePathFor } from './AuthContext';

/**
 * Route guard. This is a convenience for the user, not the security boundary: every API
 * endpoint enforces its own authentication and role requirements independently.
 */
export function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const { user, isAuthenticated, initialising } = useAuth();
  const location = useLocation();

  if (initialising) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    // Remember where they were headed so sign-in can return them there.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (adminOnly && user?.role !== 'Admin') {
    return <Navigate to={homePathFor(user)} replace />;
  }

  return <Outlet />;
}

/** Keeps a signed-in user away from the login and password-recovery pages. */
export function PublicOnlyRoute() {
  const { user, isAuthenticated, initialising } = useAuth();

  if (initialising) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return isAuthenticated ? <Navigate to={homePathFor(user)} replace /> : <Outlet />;
}
