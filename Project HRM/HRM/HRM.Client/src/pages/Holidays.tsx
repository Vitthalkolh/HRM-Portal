import {
  Alert,
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { useState } from 'react';
import { holidayApi, managementLeaveApi } from '../api/services';
import type { ManagementLeave, NationalHoliday } from '../api/types';
import { ConfirmDialog, DataState, useToast } from '../components/feedback';
import { BusyButton, PageHeader } from '../components/ui';
import { useAction, useApi } from '../hooks/useApi';
import { useAuth } from '../auth/AuthContext';
import { palette } from '../theme';
import { formatDate, parseDate, today } from '../utils/format';

type Tabs = 'national' | 'management';

/**
 * National holidays and management leave, under one page with a tab each.
 * Both are company-wide calendar events, not employee leave types.
 */
export function HolidaysPage() {
  const { isAdmin } = useAuth();
  const { notify } = useToast();
  const { busy, run } = useAction();

  const [tab, setTab] = useState<Tabs>('national');
  const [year, setYear] = useState(new Date().getFullYear());
  const [form, setForm] = useState<{ id: number; name: string; date: string; description: string } | null>(null);
  const [toDelete, setToDelete] = useState<{ id: number; label: string } | null>(null);

  const holidays = useApi(() => holidayApi.list(year), [year]);
  const management = useApi(() => managementLeaveApi.list(year), [year]);

  const active = tab === 'national' ? holidays : management;

  const save = async () => {
    if (!form) return;

    const description = form.description.trim() || null;
    const result = await run(async () => {
      if (tab === 'national') {
        const payload = { name: form.name.trim(), date: form.date, description };
        const saved = form.id ? await holidayApi.update(form.id, payload) : await holidayApi.create(payload);
        return saved.message;
      }
      const payload = { title: form.name.trim(), date: form.date, description };
      const saved = form.id
        ? await managementLeaveApi.update(form.id, payload)
        : await managementLeaveApi.create(payload);
      return saved.message;
    });

    if (result) {
      notify(result, 'success');
      setForm(null);
      active.reload();
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    const result = await run(async () => {
      const removed =
        tab === 'national'
          ? await holidayApi.remove(toDelete.id)
          : await managementLeaveApi.remove(toDelete.id);
      return removed.message;
    });
    if (result) {
      notify(result, 'success');
      setToDelete(null);
      active.reload();
    }
  };

  const rows: { id: number; label: string; date: string; description: string | null }[] =
    tab === 'national'
      ? (holidays.data ?? []).map((item: NationalHoliday) => ({
          id: item.id,
          label: item.name,
          date: item.date,
          description: item.description,
        }))
      : (management.data ?? []).map((item: ManagementLeave) => ({
          id: item.id,
          label: item.title,
          date: item.date,
          description: item.description,
        }));

  return (
    <Box>
      <PageHeader
        overline="COMPANY CALENDAR"
        title="Holidays"
        description="National holidays and management leave. Both are company-wide events and are never deducted from an employee's leave balance."
        action={
          isAdmin ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setForm({ id: 0, name: '', date: today(), description: '' })}
            >
              {tab === 'national' ? 'Add holiday' : 'Add management leave'}
            </Button>
          ) : undefined
        }
      />

      <Card>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'center' }}
          sx={{ borderBottom: `1px solid ${palette.line}`, px: 2.5 }}
        >
          <Tabs value={tab} onChange={(_, value: Tabs) => setTab(value)}>
            <Tab value="national" label="National holidays" />
            <Tab value="management" label="Management leave" />
          </Tabs>

          <TextField
            select
            label="Year"
            size="small"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            sx={{ maxWidth: 140, my: { xs: 1.5, sm: 0 } }}
          >
            {[year - 1, year, year + 1].map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Box sx={{ p: 2.5 }}>
          {tab === 'national' ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              National holidays are excluded automatically when leave days are counted.
            </Alert>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              Management leave is shown on the common calendar for everyone&apos;s awareness. It is
              not an employee leave type and cannot be applied for.
            </Alert>
          )}

          <DataState
            loading={active.loading}
            error={active.error}
            data={rows}
            onRetry={active.reload}
            emptyTitle={tab === 'national' ? 'No national holidays' : 'No management leave'}
            emptyDescription={
              isAdmin
                ? `Nothing has been recorded for ${year}. Use the button above to add the first entry.`
                : `Nothing has been recorded for ${year} yet.`
            }
          >
            {(items) => (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Day</TableCell>
                      <TableCell>{tab === 'national' ? 'Holiday' : 'Title'}</TableCell>
                      <TableCell>Description</TableCell>
                      {isAdmin && <TableCell align="right">Actions</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.date)}</TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {parseDate(row.date).toLocaleDateString(undefined, { weekday: 'long' })}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {row.label}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {row.description ?? '—'}
                          </Typography>
                        </TableCell>
                        {isAdmin && (
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              aria-label={`Edit ${row.label}`}
                              onClick={() =>
                                setForm({
                                  id: row.id,
                                  name: row.label,
                                  date: row.date,
                                  description: row.description ?? '',
                                })
                              }
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              aria-label={`Delete ${row.label}`}
                              onClick={() => setToDelete({ id: row.id, label: row.label })}
                              sx={{ color: palette.danger }}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </DataState>
        </Box>
      </Card>

      <Dialog open={form !== null} onClose={busy ? undefined : () => setForm(null)} maxWidth="xs" fullWidth>
        {form && (
          <>
            <DialogTitle>
              {form.id ? 'Edit' : 'Add'} {tab === 'national' ? 'national holiday' : 'management leave'}
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <TextField
                  label={tab === 'national' ? 'Holiday name' : 'Title'}
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                  autoFocus
                />
                <TextField
                  label="Date"
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                  required
                />
                <TextField
                  label="Description (optional)"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  multiline
                  minRows={2}
                />
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
                disabled={form.name.trim().length === 0}
              >
                Save
              </BusyButton>
            </DialogActions>
          </>
        )}
      </Dialog>

      <ConfirmDialog
        open={toDelete !== null}
        title="Remove this entry?"
        message={toDelete ? `“${toDelete.label}” will be removed from the company calendar.` : ''}
        confirmLabel="Remove"
        confirmColor="error"
        busy={busy}
        onConfirm={remove}
        onClose={() => setToDelete(null)}
      />
    </Box>
  );
}
