import {
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useMemo, useState } from 'react';
import { calendarApi } from '../api/services';
import type { CalendarEvent } from '../api/types';
import { ErrorState, LoadingState } from '../components/feedback';
import { EventChip, PageHeader, SectionCard } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { eventStyle, palette } from '../theme';
import { formatDate, monthNames, monthRange, parseDate, toIsoDate } from '../utils/format';

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * The single common calendar, shared by administrators and employees: birthdays, work
 * anniversaries, approved leave, national holidays, management leave and (for administrators)
 * notice-period dates.
 */
export function CalendarPage() {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState<string | null>(toIsoDate(now));

  const range = useMemo(() => monthRange(year, month), [year, month]);
  const { data, loading, error, reload } = useApi(
    () => calendarApi.events(range.start, range.end),
    [range.start, range.end],
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of data ?? []) {
      // A multi-day event (approved leave) appears on each day it covers.
      const start = parseDate(event.start);
      const end = parseDate(event.end);
      for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
        const key = toIsoDate(day);
        map.set(key, [...(map.get(key) ?? []), event]);
      }
    }
    return map;
  }, [data]);

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const step = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setSelected(null);
  };

  const goToToday = () => {
    const today = new Date();
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelected(toIsoDate(today));
  };

  const selectedEvents = selected ? (eventsByDate.get(selected) ?? []) : [];
  const todayIso = toIsoDate(new Date());

  return (
    <Box>
      <PageHeader
        overline="CALENDAR"
        title="Common calendar"
        description="One shared calendar for the whole company: celebrations, time off and company holidays."
      />

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 8.5 }}>
          <Card>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${palette.line}` }}
            >
              <Typography variant="h5">
                {monthNames[month]} {year}
              </Typography>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Button size="small" onClick={goToToday}>
                  Today
                </Button>
                <IconButton onClick={() => step(-1)} aria-label="Previous month" size="small">
                  <ChevronLeftIcon />
                </IconButton>
                <IconButton onClick={() => step(1)} aria-label="Next month" size="small">
                  <ChevronRightIcon />
                </IconButton>
              </Stack>
            </Stack>

            <Box sx={{ p: { xs: 1, sm: 2 } }}>
              {loading && <LoadingState rows={6} label="Loading the calendar" />}
              {!loading && error && <ErrorState message={error} onRetry={reload} />}

              {!loading && !error && (
                <>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(7, 1fr)',
                      gap: 0.75,
                      mb: 0.75,
                    }}
                  >
                    {weekdayLabels.map((label) => (
                      <Typography
                        key={label}
                        variant="caption"
                        align="center"
                        sx={{ fontWeight: 700, color: palette.faint, letterSpacing: '.06em' }}
                      >
                        {isCompact ? label[0] : label}
                      </Typography>
                    ))}
                  </Box>

                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.75 }}>
                    {grid.map((cell, index) => {
                      const iso = cell ? toIsoDate(cell) : null;
                      const dayEvents = iso ? (eventsByDate.get(iso) ?? []) : [];
                      const isToday = iso === todayIso;
                      const isSelected = iso !== null && iso === selected;
                      const isWeekend = cell !== null && (cell.getDay() === 0 || cell.getDay() === 6);

                      if (!cell) return <Box key={`blank-${index}`} sx={{ minHeight: { xs: 60, sm: 92 } }} />;

                      return (
                        <Box
                          key={iso}
                          onClick={() => setSelected(iso)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') setSelected(iso);
                          }}
                          sx={{
                            minHeight: { xs: 60, sm: 92 },
                            p: 0.75,
                            borderRadius: 2.5,
                            cursor: 'pointer',
                            border: `1px solid ${isSelected ? palette.purple : palette.line}`,
                            background: isSelected
                              ? palette.purpleSoft
                              : isWeekend
                                ? '#fafbfe'
                                : '#fff',
                            transition: 'border-color .12s ease, background .12s ease',
                            '&:hover': { borderColor: palette.purple },
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: isToday ? 800 : 600,
                                width: 21,
                                height: 21,
                                borderRadius: '50%',
                                display: 'grid',
                                placeItems: 'center',
                                background: isToday ? palette.purple : 'transparent',
                                color: isToday ? '#fff' : isWeekend ? palette.faint : palette.ink,
                              }}
                            >
                              {cell.getDate()}
                            </Typography>
                            {dayEvents.length > 0 && isCompact && (
                              <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: palette.purple }} />
                            )}
                          </Stack>

                          {!isCompact && (
                            <Stack spacing={0.35} sx={{ mt: 0.5 }}>
                              {dayEvents.slice(0, 2).map((event) => {
                                const style = eventStyle(event.type);
                                return (
                                  <Tooltip key={event.id} title={event.title}>
                                    <Box
                                      sx={{
                                        px: 0.75,
                                        py: 0.2,
                                        borderRadius: 1,
                                        background: style.background,
                                        color: style.color,
                                        fontSize: 10.5,
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                      }}
                                    >
                                      {event.title}
                                    </Box>
                                  </Tooltip>
                                );
                              })}
                              {dayEvents.length > 2 && (
                                <Typography variant="caption" sx={{ color: palette.faint, pl: 0.75 }}>
                                  +{dayEvents.length - 2} more
                                </Typography>
                              )}
                            </Stack>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                </>
              )}
            </Box>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 3.5 }}>
          <Stack spacing={2.5}>
            <SectionCard title={selected ? formatDate(selected) : 'Select a day'}>
              {selectedEvents.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {selected ? 'Nothing scheduled on this day.' : 'Pick a day to see what is happening.'}
                </Typography>
              ) : (
                <Stack spacing={1.5}>
                  {selectedEvents.map((event) => (
                    <Box key={event.id}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.35 }}>
                        <EventChip type={event.type} />
                      </Stack>
                      <Typography variant="body2" fontWeight={600}>
                        {event.title}
                      </Typography>
                      {event.description && (
                        <Typography variant="caption" color="text.secondary">
                          {event.description}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Stack>
              )}
            </SectionCard>

            <SectionCard title="Legend">
              <Stack direction="row" flexWrap="wrap" gap={0.75}>
                {['Birthday', 'WorkAnniversary', 'Leave', 'NationalHoliday', 'ManagementLeave'].map((type) => {
                  const style = eventStyle(type);
                  return (
                    <Chip
                      key={type}
                      size="small"
                      label={style.label}
                      sx={{ color: style.color, background: style.background }}
                    />
                  );
                })}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                National holidays and management leave are company events. They are never deducted
                from anyone&apos;s leave balance.
              </Typography>
            </SectionCard>

            <SectionCard title={`This month (${data?.length ?? 0})`}>
              {(data?.length ?? 0) === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nothing is scheduled this month.
                </Typography>
              ) : (
                <Stack spacing={1} sx={{ maxHeight: 280, overflowY: 'auto' }}>
                  {(data ?? []).map((event) => (
                    <Stack key={event.id} direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" sx={{ width: 52, flexShrink: 0, color: palette.faint }}>
                        {parseDate(event.start).getDate()} {monthNames[parseDate(event.start).getMonth()].slice(0, 3)}
                      </Typography>
                      <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                        {event.title}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </SectionCard>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}

/** Month grid starting on Monday, padded with nulls so the weeks line up. */
function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // getDay() is Sunday-based; shift so Monday is the first column.
  const leading = (first.getDay() + 6) % 7;

  const cells: (Date | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}
