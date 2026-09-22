import {
  Alert,
  Box,
  Card,
  CardContent,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { leaveApi } from '../api/services';
import type { LeaveDaysPreview } from '../api/types';
import { useToast } from '../components/feedback';
import { BusyButton, PageHeader, SectionCard } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { palette } from '../theme';
import { formatDays, today } from '../utils/format';

type DurationMode = 'Single' | 'Multiple';

/**
 * Leave application form.
 *
 * Single day shows one date field; multiple days shows from and to. The number of days is
 * calculated by the server (/api/leaves/preview) so the figure shown here is exactly the
 * figure that will be deducted — the client never does its own day arithmetic.
 */
export function ApplyLeavePage() {
  const navigate = useNavigate();
  const { notify } = useToast();

  const types = useApi(() => leaveApi.types());
  const balances = useApi(() => leaveApi.balance());

  const [leaveTypeId, setLeaveTypeId] = useState<number | ''>('');
  const [mode, setMode] = useState<DurationMode>('Single');
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDaySession, setHalfDaySession] = useState('First Half');
  const [reason, setReason] = useState('');

  const [preview, setPreview] = useState<LeaveDaysPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedType = types.data?.find((type) => type.id === leaveTypeId);
  const selectedBalance = balances.data?.find((balance) => balance.leaveTypeId === leaveTypeId);

  // A type that does not allow half days must not keep a stale half-day selection.
  useEffect(() => {
    if (selectedType && !selectedType.allowHalfDay && isHalfDay) setIsHalfDay(false);
  }, [selectedType, isHalfDay]);

  // Switching to a single day collapses the range to one date.
  useEffect(() => {
    if (mode === 'Single') setToDate(fromDate);
    else if (isHalfDay) setIsHalfDay(false);
  }, [mode, fromDate, isHalfDay]);

  // Ask the server how many working days the selection is worth.
  useEffect(() => {
    if (!fromDate) return;
    const effectiveTo = mode === 'Single' ? fromDate : toDate;
    if (!effectiveTo || effectiveTo < fromDate) {
      setPreview(null);
      setPreviewError(mode === 'Multiple' ? 'The end date cannot be before the start date.' : null);
      return;
    }

    let active = true;
    setPreviewError(null);

    leaveApi
      .preview(fromDate, effectiveTo, isHalfDay)
      .then((result) => {
        if (active) setPreview(result);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setPreview(null);
        setPreviewError(cause instanceof ApiError ? cause.message : 'Could not calculate the days.');
      });

    return () => {
      active = false;
    };
  }, [fromDate, toDate, mode, isHalfDay]);

  const availabilityWarning = useMemo(() => {
    if (!selectedBalance || !preview) return null;
    if (preview.days > selectedBalance.available) {
      return `That is ${formatDays(preview.days)} day(s), but only ${formatDays(
        selectedBalance.available,
      )} ${selectedType?.code ?? ''} day(s) are available once pending requests are counted.`;
    }
    return null;
  }, [selectedBalance, preview, selectedType]);

  const canSubmit =
    leaveTypeId !== '' &&
    reason.trim().length > 0 &&
    (preview?.days ?? 0) > 0 &&
    previewError === null &&
    availabilityWarning === null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (leaveTypeId === '') return;

    setError(null);
    setBusy(true);

    try {
      const { message } = await leaveApi.apply({
        leaveTypeId,
        durationMode: mode,
        fromDate,
        toDate: mode === 'Single' ? null : toDate,
        isHalfDay,
        halfDaySession: isHalfDay ? halfDaySession : null,
        reason: reason.trim(),
      });

      notify(message, 'success');
      navigate('/employee/leave/history');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to submit the request right now.');
      setBusy(false);
    }
  };

  return (
    <Box>
      <PageHeader
        overline="LEAVE"
        title="Apply for leave"
        description="Weekends and national holidays are never counted, and pending requests are already taken into account."
      />

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card>
            <CardContent>
              <Box component="form" onSubmit={submit} noValidate>
                <Stack spacing={2.5}>
                  {error && <Alert severity="error">{error}</Alert>}

                  <TextField
                    select
                    label="Leave type"
                    value={leaveTypeId}
                    onChange={(event) => setLeaveTypeId(Number(event.target.value))}
                    required
                    helperText={
                      selectedBalance
                        ? `${formatDays(selectedBalance.available)} day(s) available of ${formatDays(
                            selectedBalance.total,
                          )}`
                        : 'Only employee leave types appear here.'
                    }
                    disabled={types.loading}
                  >
                    {(types.data ?? []).map((type) => (
                      <MenuItem key={type.id} value={type.id}>
                        {type.name} ({type.code})
                      </MenuItem>
                    ))}
                  </TextField>

                  <Box>
                    <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                      Duration
                    </Typography>
                    <ToggleButtonGroup
                      exclusive
                      value={mode}
                      onChange={(_, value: DurationMode | null) => value && setMode(value)}
                      size="small"
                      sx={{
                        '& .MuiToggleButton-root': { px: 2.5, textTransform: 'none', fontWeight: 600 },
                        '& .Mui-selected': { background: `${palette.purple} !important`, color: '#fff !important' },
                      }}
                    >
                      <ToggleButton value="Single">Single day</ToggleButton>
                      <ToggleButton value="Multiple">Multiple days</ToggleButton>
                    </ToggleButtonGroup>
                  </Box>

                  {mode === 'Single' ? (
                    <TextField
                      label="Date"
                      type="date"
                      value={fromDate}
                      onChange={(event) => setFromDate(event.target.value)}
                      slotProps={{ inputLabel: { shrink: true } }}
                      required
                    />
                  ) : (
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="From date"
                          type="date"
                          value={fromDate}
                          onChange={(event) => setFromDate(event.target.value)}
                          slotProps={{ inputLabel: { shrink: true } }}
                          required
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="To date"
                          type="date"
                          value={toDate}
                          onChange={(event) => setToDate(event.target.value)}
                          slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: fromDate } }}
                          error={toDate < fromDate}
                          required
                        />
                      </Grid>
                    </Grid>
                  )}

                  {mode === 'Single' && selectedType?.allowHalfDay && (
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          select
                          label="Full or half day"
                          value={isHalfDay ? 'half' : 'full'}
                          onChange={(event) => setIsHalfDay(event.target.value === 'half')}
                        >
                          <MenuItem value="full">Full day</MenuItem>
                          <MenuItem value="half">Half day</MenuItem>
                        </TextField>
                      </Grid>
                      {isHalfDay && (
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            select
                            label="Which half"
                            value={halfDaySession}
                            onChange={(event) => setHalfDaySession(event.target.value)}
                          >
                            <MenuItem value="First Half">First half</MenuItem>
                            <MenuItem value="Second Half">Second half</MenuItem>
                          </TextField>
                        </Grid>
                      )}
                    </Grid>
                  )}

                  <TextField
                    label="Reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    multiline
                    minRows={3}
                    required
                    slotProps={{ htmlInput: { maxLength: 500 } }}
                    helperText={`A reason is required. ${reason.length}/500`}
                    error={reason.length === 0 && busy}
                  />

                  {previewError && <Alert severity="warning">{previewError}</Alert>}
                  {availabilityWarning && <Alert severity="warning">{availabilityWarning}</Alert>}

                  <Stack direction="row" spacing={1.5}>
                    <BusyButton
                      type="submit"
                      variant="contained"
                      size="large"
                      busy={busy}
                      busyLabel="Submitting…"
                      disabled={!canSubmit}
                    >
                      Submit request
                    </BusyButton>
                    <BusyButton
                      busy={false}
                      variant="outlined"
                      size="large"
                      color="inherit"
                      onClick={() => navigate('/employee/leave/history')}
                    >
                      Cancel
                    </BusyButton>
                  </Stack>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={2.5}>
            <SectionCard title="This request">
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                  <Typography color="text.secondary">Days deducted</Typography>
                  <Typography variant="h3" sx={{ color: palette.purple }}>
                    {preview ? formatDays(preview.days) : '—'}
                  </Typography>
                </Stack>

                {preview && preview.excluded.length > 0 && (
                  <Box>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
                      <InfoOutlinedIcon fontSize="small" sx={{ color: palette.faint }} />
                      <Typography variant="body2" fontWeight={600}>
                        Not counted
                      </Typography>
                    </Stack>
                    <Stack spacing={0.35}>
                      {preview.excluded.slice(0, 8).map((item) => (
                        <Typography key={item} variant="caption" color="text.secondary">
                          {item}
                        </Typography>
                      ))}
                      {preview.excluded.length > 8 && (
                        <Typography variant="caption" color="text.secondary">
                          and {preview.excluded.length - 8} more…
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </SectionCard>

            <SectionCard title="My balances">
              <Stack spacing={1.25}>
                {(balances.data ?? []).map((balance) => (
                  <Stack key={balance.leaveTypeId} direction="row" justifyContent="space-between">
                    <Typography variant="body2">{balance.name}</Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {formatDays(balance.available)} / {formatDays(balance.total)}
                    </Typography>
                  </Stack>
                ))}
                <Typography variant="caption" color="text.secondary" sx={{ pt: 0.5 }}>
                  Available excludes days already approved and days awaiting approval.
                </Typography>
              </Stack>
            </SectionCard>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
