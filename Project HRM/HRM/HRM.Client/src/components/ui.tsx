import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
  type ButtonProps,
  type TextFieldProps,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useState, type ReactNode } from 'react';
import { eventStyle, palette } from '../theme';
import type { LeaveStatus } from '../api/types';

/**
 * Password input with a show/hide toggle. Every password field in the product uses this, so
 * the eye control and its accessible labelling are consistent everywhere.
 */
export function PasswordField(props: Omit<TextFieldProps, 'type'>) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label={visible ? 'Hide password' : 'Show password'}
                onClick={() => setVisible((current) => !current)}
                onMouseDown={(event) => event.preventDefault()}
                edge="end"
                size="small"
              >
                {visible ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}

/**
 * A button that shows progress and refuses further clicks while the action is running, so a
 * double click can never submit twice.
 */
export function BusyButton({
  busy,
  busyLabel,
  children,
  disabled,
  startIcon,
  ...props
}: ButtonProps & { busy: boolean; busyLabel?: string }) {
  return (
    <Button
      {...props}
      disabled={busy || disabled}
      startIcon={busy ? <CircularProgress size={16} color="inherit" /> : startIcon}
    >
      {busy ? (busyLabel ?? 'Working…') : children}
    </Button>
  );
}

export function PageHeader({
  title,
  description,
  action,
  overline,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  overline?: string;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'stretch', sm: 'flex-end' }}
      spacing={2}
      sx={{ mb: 3 }}
    >
      <Box>
        {overline && (
          <Typography variant="overline" color="primary" display="block">
            {overline}
          </Typography>
        )}
        <Typography variant="h3">{title}</Typography>
        {description && (
          <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 680 }}>
            {description}
          </Typography>
        )}
      </Box>
      {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
    </Stack>
  );
}

export function StatCard({
  label,
  value,
  caption,
  icon,
  tone = 'default',
  onClick,
}: {
  label: string;
  value: ReactNode;
  caption?: string;
  icon?: ReactNode;
  tone?: 'default' | 'purple' | 'success' | 'warning' | 'danger';
  onClick?: () => void;
}) {
  const tones = {
    default: { color: palette.muted, background: '#eef0f6' },
    purple: { color: palette.purple, background: palette.purpleSoft },
    success: { color: palette.success, background: '#e4f6f1' },
    warning: { color: palette.warning, background: '#fff4e0' },
    danger: { color: palette.danger, background: '#fdeaec' },
  }[tone];

  return (
    <Card
      onClick={onClick}
      sx={{
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform .15s ease, box-shadow .15s ease',
        '&:hover': onClick
          ? { transform: 'translateY(-2px)', boxShadow: '0 12px 28px rgba(16,24,40,.10)' }
          : undefined,
      }}
    >
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary" noWrap>
              {label}
            </Typography>
            <Typography variant="h2" sx={{ mt: 0.5, fontSize: 34 }}>
              {value}
            </Typography>
            {caption && (
              <Typography variant="caption" color="text.secondary">
                {caption}
              </Typography>
            )}
          </Box>
          {icon && (
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2.5,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                color: tones.color,
                background: tones.background,
              }}
            >
              {icon}
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

const leaveStatusTones: Record<LeaveStatus, { color: string; background: string }> = {
  Pending: { color: palette.warning, background: '#fff4e0' },
  Approved: { color: palette.success, background: '#e4f6f1' },
  Rejected: { color: palette.danger, background: '#fdeaec' },
  Cancelled: { color: palette.muted, background: '#eef0f6' },
  Withdrawn: { color: palette.muted, background: '#eef0f6' },
};

export function StatusChip({ status, size = 'small' }: { status: string; size?: 'small' | 'medium' }) {
  const tone =
    leaveStatusTones[status as LeaveStatus] ??
    ({
      Submitted: { color: palette.info, background: '#e7f0fb' },
      Screening: { color: palette.warning, background: '#fff4e0' },
      Interviewing: { color: palette.purple, background: palette.purpleSoft },
      Hired: { color: palette.success, background: '#e4f6f1' },
      Active: { color: palette.success, background: '#e4f6f1' },
      NoticePeriod: { color: palette.warning, background: '#fff4e0' },
      Resigned: { color: palette.muted, background: '#eef0f6' },
    }[status] ?? { color: palette.muted, background: '#eef0f6' });

  const label = status === 'NoticePeriod' ? 'Notice period' : status;

  return (
    <Chip
      size={size}
      label={label}
      sx={{ color: tone.color, background: tone.background, border: 'none' }}
    />
  );
}

export function EventChip({ type, size = 'small' }: { type: string; size?: 'small' | 'medium' }) {
  const style = eventStyle(type);
  return <Chip size={size} label={style.label} sx={{ color: style.color, background: style.background }} />;
}

/** A white card with a heading, used for every content block so the pages stay consistent. */
export function SectionCard({
  title,
  description,
  action,
  children,
  dense = false,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  dense?: boolean;
}) {
  return (
    <Card sx={{ height: '100%' }}>
      {(title || action) && (
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          spacing={1}
          sx={{ px: 2.75, pt: 2.5, pb: description ? 0.5 : 1.5 }}
        >
          <Box sx={{ minWidth: 0 }}>
            {title && <Typography variant="h6">{title}</Typography>}
            {description && (
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            )}
          </Box>
          {action}
        </Stack>
      )}
      <CardContent sx={{ pt: title ? 1.5 : 2.5, px: dense ? 0 : 2.75, pb: dense ? '0 !important' : undefined }}>
        {children}
      </CardContent>
    </Card>
  );
}
