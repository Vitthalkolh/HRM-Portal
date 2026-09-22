import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { useState } from 'react';
import { planningApi } from '../api/services';
import type { PlanningEvent, PlanningType } from '../api/types';
import { ConfirmDialog, DataState, useToast } from '../components/feedback';
import { BusyButton, EventChip, PageHeader } from '../components/ui';
import { useAction, useApi } from '../hooks/useApi';
import { useAuth } from '../auth/AuthContext';
import { eventStyle, palette } from '../theme';
import { formatDate, parseDate, today } from '../utils/format';

const planningTypes: { value: PlanningType; label: string; help: string }[] = [
  { value: 'NT', label: 'NTNS release', help: 'Quarterly production release, on a Sunday.' },
  { value: 'IT', label: 'Dry run', help: 'One week before each NTNS release.' },
  { value: 'SNU', label: 'SNU release', help: 'Fortnightly, on a Wednesday.' },
  { value: 'E', label: 'Company event', help: 'Functions, offsites and other company events.' },
];

const emptyForm = {
  id: 0,
  title: '',
  type: 'E' as PlanningType,
  startDate: today(),
  endDate: today(),
  description: '',
  location: '',
  notes: '',
};

/**
 * The company planning calendar: releases and events. Separate from the common HR calendar.
 * Administrators manage it; employees have read-only access.
 */
export function CompanyPlanningPage() {
  const { isAdmin } = useAuth();
  const { notify } = useToast();
  const { busy, run } = useAction();

  const [year, setYear] = useState(new Date().getFullYear());
  const [typeFilter, setTypeFilter] = useState('');
  const [form, setForm] = useState<typeof emptyForm | null>(null);
  const [toDelete, setToDelete] = useState<PlanningEvent | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);

  const events = useApi(
    () => planningApi.list(`${year}-01-01`, `${year}-12-31`, typeFilter || undefined),
    [year, typeFilter],
  );

  const save = async () => {
    if (!form) return;

    const payload = {
      title: form.title.trim(),
      type: form.type,
      startDate: form.startDate,
      endDate: form.endDate,
      description: form.description.trim() || null,
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
    };

    const result = await run(() => (form.id ? planningApi.update(form.id, payload) : planningApi.create(payload)));
    if (result) {
      notify(result.message, 'success');
      setForm(null);
      events.reload();
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    const result = await run(() => planningApi.remove(toDelete.id));
    if (result) {
      notify(result.message, 'success');
      setToDelete(null);
      events.reload();
    }
  };

  const byType = (type: PlanningType) => (events.data ?? []).filter((event) => event.type === type).length;

  return (
    <Box>
      <PageHeader
        overline="PLANNING"
        title="Company planning"
        description={
          isAdmin
            ? 'Releases and company events. Generate the yearly release schedule, then adjust any date by hand.'
            : 'Upcoming releases and company events. This calendar is maintained by your administrators.'
        }
        action={
          isAdmin ? (
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" startIcon={<AutoAwesomeIcon />} onClick={() => setGenerateOpen(true)}>
                Generate schedule
              </Button>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setForm({ ...emptyForm })}>
                Add event
              </Button>
            </Stack>
          ) : undefined
        }
      />

      <Grid container spacing={2.5} sx={{ mb: 0.5 }}>
        {planningTypes.map((type) => {
          const style = eventStyle(type.value);
          return (
            <Grid key={type.value} size={{ xs: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      {type.label}
                    </Typography>
                    <Chip size="small" label={type.value} sx={{ color: style.color, background: style.background }} />
                  </Stack>
                  <Typography variant="h3" sx={{ mt: 1, fontSize: 30 }}>
                    {byType(type.value)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {type.help}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Card sx={{ mt: 2.5 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ p: 2.5, pb: 1.5 }}>
          <TextField
            select
            label="Year"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            sx={{ maxWidth: { sm: 160 } }}
          >
            {[year - 1, year, year + 1].map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Type"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            sx={{ maxWidth: { sm: 220 } }}
          >
            <MenuItem value="">All types</MenuItem>
            {planningTypes.map((type) => (
              <MenuItem key={type.value} value={type.value}>
                {type.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <DataState
            loading={events.loading}
            error={events.error}
            data={events.data}
            onRetry={events.reload}
            emptyTitle="No planning events"
            emptyDescription={
              isAdmin
                ? 'Generate the yearly release schedule or add an event by hand.'
                : 'Nothing has been scheduled for this year yet.'
            }
          >
            {(items) => (
              <Stack spacing={1}>
                {items.map((event) => {
                  const style = eventStyle(event.type);
                  const date = parseDate(event.startDate);

                  return (
                    <Stack
                      key={event.id}
                      direction="row"
                      spacing={2}
                      alignItems="center"
                      sx={{
                        p: 1.5,
                        borderRadius: 3,
                        border: `1px solid ${palette.line}`,
                        borderLeft: `4px solid ${style.color}`,
                      }}
                    >
                      <Box sx={{ width: 54, textAlign: 'center', flexShrink: 0 }}>
                        <Typography variant="h6" lineHeight={1}>
                          {date.getDate()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {date.toLocaleDateString(undefined, { month: 'short' })}
                        </Typography>
                      </Box>

                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Typography variant="body2" fontWeight={700} noWrap>
                            {event.title}
                          </Typography>
                          <EventChip type={event.type} />
                          {event.isGenerated && !event.isOverridden && (
                            <Tooltip title="Created by the schedule generator">
                              <Chip size="small" variant="outlined" label="Generated" />
                            </Tooltip>
                          )}
                          {event.isOverridden && (
                            <Tooltip title="Edited by an administrator; regeneration will not overwrite it">
                              <Chip size="small" variant="outlined" color="primary" label="Adjusted" />
                            </Tooltip>
                          )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(event.startDate)}
                          {event.startDate !== event.endDate && ` – ${formatDate(event.endDate)}`}
                          {event.location && ` · ${event.location}`}
                          {event.description && ` · ${event.description}`}
                        </Typography>
                      </Box>

                      {isAdmin && (
                        <Stack direction="row" spacing={0.5}>
                          <IconButton
                            size="small"
                            aria-label={`Edit ${event.title}`}
                            onClick={() =>
                              setForm({
                                id: event.id,
                                title: event.title,
                                type: event.type,
                                startDate: event.startDate,
                                endDate: event.endDate,
                                description: event.description ?? '',
                                location: event.location ?? '',
                                notes: event.notes ?? '',
                              })
                            }
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            aria-label={`Delete ${event.title}`}
                            onClick={() => setToDelete(event)}
                            sx={{ color: palette.danger }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      )}
                    </Stack>
                  );
                })}
              </Stack>
            )}
          </DataState>
        </Box>
      </Card>

      {/* ---------------- add / edit ---------------- */}
      <Dialog open={form !== null} onClose={busy ? undefined : () => setForm(null)} maxWidth="sm" fullWidth>
        {form && (
          <>
            <DialogTitle>{form.id ? 'Edit planning event' : 'Add planning event'}</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <TextField
                  label="Title"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  required
                  autoFocus
                />

                <TextField
                  select
                  label="Type"
                  value={form.type}
                  onChange={(event) => setForm({ ...form, type: event.target.value as PlanningType })}
                  helperText={planningTypes.find((type) => type.value === form.type)?.help}
                >
                  {planningTypes.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label} ({type.value})
                    </MenuItem>
                  ))}
                </TextField>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Start date"
                      type="date"
                      value={form.startDate}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          startDate: event.target.value,
                          endDate: form.endDate < event.target.value ? event.target.value : form.endDate,
                        })
                      }
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="End date"
                      type="date"
                      value={form.endDate}
                      onChange={(event) => setForm({ ...form, endDate: event.target.value })}
                      slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: form.startDate } }}
                      error={form.endDate < form.startDate}
                    />
                  </Grid>
                </Grid>

                <TextField
                  label="Description"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  multiline
                  minRows={2}
                />

                <TextField
                  label="Location (optional)"
                  value={form.location}
                  onChange={(event) => setForm({ ...form, location: event.target.value })}
                />

                {form.id > 0 && (
                  <Alert severity="info">
                    Editing a generated event marks it as adjusted, so regenerating the schedule
                    will leave your change alone.
                  </Alert>
                )}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5 }}>
              <Button onClick={() => setForm(null)} disabled={busy} color="inherit">
                Cancel
              </Button>
              <BusyButton
                variant="contained"
                busy={busy}
                busyLabel="Saving…"
                onClick={save}
                disabled={form.title.trim().length === 0 || form.endDate < form.startDate}
              >
                Save
              </BusyButton>
            </DialogActions>
          </>
        )}
      </Dialog>

      <GenerateScheduleDialog
        open={generateOpen}
        year={year}
        onClose={() => setGenerateOpen(false)}
        onGenerated={() => {
          setGenerateOpen(false);
          events.reload();
        }}
      />

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this planning event?"
        message={toDelete ? `“${toDelete.title}” on ${formatDate(toDelete.startDate)} will be removed.` : ''}
        confirmLabel="Delete"
        confirmColor="error"
        busy={busy}
        onConfirm={remove}
        onClose={() => setToDelete(null)}
      />
    </Box>
  );
}

/** Previews and then writes the generated release schedule for a year. */
function GenerateScheduleDialog({
  open,
  year,
  onClose,
  onGenerated,
}: {
  open: boolean;
  year: number;
  onClose: () => void;
  onGenerated: () => void;
}) {
  const { notify } = useToast();
  const { busy, run } = useAction();

  const [targetYear, setTargetYear] = useState(year);
  const [anchor, setAnchor] = useState('');
  const [replace, setReplace] = useState(false);
  const preview = useApi(
    () => (open ? planningApi.preview(targetYear, anchor || null) : Promise.resolve(null)),
    [open, targetYear, anchor],
  );

  const generate = async () => {
    const result = await run(() => planningApi.generate(targetYear, anchor || null, replace));
    if (result) {
      notify(result.message, 'success');
      onGenerated();
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Generate the release schedule</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Four NTNS releases a year on Sundays, a dry run one week before each, and a fortnightly
            SNU release on Wednesdays. An SNU release that falls too close to an NTNS release is
            cancelled automatically.
          </Typography>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 5 }}>
              <TextField
                select
                label="Year"
                value={targetYear}
                onChange={(event) => setTargetYear(Number(event.target.value))}
              >
                {[year, year + 1, year + 2].map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 7 }}>
              <TextField
                label="First NTNS release (optional)"
                type="date"
                value={anchor}
                onChange={(event) => setAnchor(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                helperText="Left empty, the first Sunday after 8 January is used."
              />
            </Grid>
          </Grid>

          <TextField
            select
            label="Existing generated events"
            value={replace ? 'replace' : 'keep'}
            onChange={(event) => setReplace(event.target.value === 'replace')}
          >
            <MenuItem value="keep">Keep them and add anything missing</MenuItem>
            <MenuItem value="replace">Replace untouched generated events</MenuItem>
          </TextField>

          {preview.data && (
            <Box>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>
                Preview: {preview.data.events.length} event(s)
              </Typography>
              <Stack spacing={0.5} sx={{ maxHeight: 190, overflowY: 'auto' }}>
                {preview.data.events.map((event, index) => (
                  <Stack key={index} direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption" sx={{ width: 96, flexShrink: 0, color: palette.faint }}>
                      {formatDate(event.startDate)}
                    </Typography>
                    <EventChip type={event.type} />
                    <Typography variant="caption" noWrap>
                      {event.title}
                    </Typography>
                  </Stack>
                ))}
              </Stack>

              {preview.data.cancelledSnu.length > 0 && (
                <Alert severity="info" sx={{ mt: 1.5 }}>
                  <Typography variant="body2" fontWeight={600}>
                    {preview.data.cancelledSnu.length} SNU release(s) cancelled
                  </Typography>
                  {preview.data.cancelledSnu.slice(0, 3).map((note) => (
                    <Typography key={note} variant="caption" display="block">
                      {note}
                    </Typography>
                  ))}
                </Alert>
              )}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={busy} color="inherit">
          Cancel
        </Button>
        <BusyButton variant="contained" busy={busy} busyLabel="Generating…" onClick={generate}>
          Generate
        </BusyButton>
      </DialogActions>
    </Dialog>
  );
}
