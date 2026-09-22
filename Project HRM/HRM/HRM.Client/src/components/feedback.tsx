import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Skeleton,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InboxIcon from '@mui/icons-material/Inbox';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { palette } from '../theme';

// ---------------------------------------------------------------- toasts

type ToastSeverity = 'success' | 'error' | 'info' | 'warning';
interface Toast {
  message: string;
  severity: ToastSeverity;
}

const ToastContext = createContext<{
  notify: (message: string, severity?: ToastSeverity) => void;
} | null>(null);

/**
 * Success and failure feedback. Messages dismiss themselves after a few seconds, as the
 * requirements ask, and errors linger a little longer so they can be read.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);

  const notify = useCallback((message: string, severity: ToastSeverity = 'success') => {
    setToast({ message, severity });
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        open={toast !== null}
        autoHideDuration={toast?.severity === 'error' ? 7000 : 4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setToast(null)}
          severity={toast?.severity ?? 'success'}
          variant="filled"
          sx={{ minWidth: 300, boxShadow: '0 12px 32px rgba(16,24,40,.18)' }}
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside a ToastProvider.');
  return context;
}

// ---------------------------------------------------------------- page states

export function LoadingState({ rows = 4, label = 'Loading…' }: { rows?: number; label?: string }) {
  return (
    <Box role="status" aria-live="polite" aria-busy="true" sx={{ py: 1 }}>
      <Box sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{label}</Box>
      <Stack spacing={1.25}>
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} variant="rounded" height={index === 0 ? 44 : 34} animation="wave" />
        ))}
      </Stack>
    </Box>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Stack alignItems="center" spacing={1.25} sx={{ py: 6, px: 2, textAlign: 'center' }}>
      <Box
        sx={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: palette.purpleSoft,
          color: palette.purple,
        }}
      >
        <InboxIcon />
      </Box>
      <Typography variant="h6">{title}</Typography>
      {description && (
        <Typography color="text.secondary" variant="body2" maxWidth={420}>
          {description}
        </Typography>
      )}
      {action}
    </Stack>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Stack alignItems="center" spacing={1.5} sx={{ py: 5, px: 2, textAlign: 'center' }}>
      <Box
        sx={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: '#fdeaec',
          color: palette.danger,
        }}
      >
        <ErrorOutlineIcon />
      </Box>
      <Typography variant="h6">That didn&apos;t load</Typography>
      <Typography color="text.secondary" variant="body2" maxWidth={460}>
        {message}
      </Typography>
      {onRetry && (
        <Button onClick={onRetry} variant="outlined">
          Try again
        </Button>
      )}
    </Stack>
  );
}

/**
 * Renders the right thing for each stage of an API-driven view: loading, error, empty, loaded.
 * Every list page in the product goes through this so the states are never forgotten.
 */
export function DataState<T>({
  loading,
  error,
  data,
  onRetry,
  emptyTitle,
  emptyDescription,
  emptyAction,
  skeletonRows,
  children,
}: {
  loading: boolean;
  error: string | null;
  data: T[] | null | undefined;
  onRetry?: () => void;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  skeletonRows?: number;
  children: (items: T[]) => ReactNode;
}) {
  if (loading) return <LoadingState rows={skeletonRows} />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!data || data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }
  return <>{children(data)}</>;
}

// ---------------------------------------------------------------- confirmation

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmColor = 'primary',
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: 'primary' | 'error' | 'warning' | 'success';
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={busy} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color={confirmColor}
          disabled={busy}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
