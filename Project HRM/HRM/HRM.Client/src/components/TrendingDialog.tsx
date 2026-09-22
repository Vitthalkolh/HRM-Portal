import {
  Avatar,
  Box,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CakeIcon from '@mui/icons-material/Cake';
import CelebrationIcon from '@mui/icons-material/Celebration';
import CloseIcon from '@mui/icons-material/Close';
import EventIcon from '@mui/icons-material/Event';
import FlagIcon from '@mui/icons-material/Flag';
import { useEffect, useMemo, useState } from 'react';
import { calendarApi } from '../api/services';
import type { Highlight, Highlights } from '../api/types';
import { palette } from '../theme';
import { EmptyState, ErrorState, LoadingState } from './feedback';
import { formatDayMonth } from '../utils/format';

const icons: Record<Highlight['type'], typeof CakeIcon> = {
  Birthday: CakeIcon,
  WorkAnniversary: CelebrationIcon,
  NationalHoliday: FlagIcon,
  CompanyEvent: EventIcon,
};

const tones: Record<Highlight['type'], { color: string; background: string; label: string }> = {
  Birthday: { color: '#c2417a', background: '#fdebf3', label: 'Birthday' },
  WorkAnniversary: { color: palette.success, background: '#e4f6f1', label: 'Work anniversary' },
  NationalHoliday: { color: palette.warning, background: '#fff4e0', label: 'National holiday' },
  CompanyEvent: { color: palette.purple, background: palette.purpleSoft, label: 'Company event' },
};

/**
 * The trending / monthly highlights popup: this month's birthdays, work anniversaries,
 * national holidays and company events.
 *
 * The avatars orbit slowly on a circle. The motion is decorative only — the same items are
 * listed underneath, the ring is hidden on small screens, and it stops entirely when the
 * viewer prefers reduced motion.
 */
export function TrendingDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('sm'));
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const [data, setData] = useState<Highlights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const now = new Date();

    setLoading(true);
    setError(null);

    calendarApi
      .highlights(now.getFullYear(), now.getMonth() + 1)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const people = useMemo(
    () => (data?.items ?? []).filter((item) => item.type === 'Birthday' || item.type === 'WorkAnniversary'),
    [data],
  );

  const showRing = !isCompact && !prefersReducedMotion && people.length > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={isCompact}>
      <Box
        sx={{
          background: 'linear-gradient(135deg, #0c1128, #2a1a68)',
          color: '#fff',
          px: 3,
          pt: 3,
          pb: showRing ? 0 : 3,
          position: 'relative',
        }}
      >
        <IconButton
          onClick={onClose}
          aria-label="Close highlights"
          sx={{ position: 'absolute', right: 10, top: 10, color: 'rgba(255,255,255,.75)' }}
        >
          <CloseIcon />
        </IconButton>

        <Typography variant="overline" sx={{ color: '#b6aaff' }}>
          TRENDING THIS MONTH
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          {data?.monthName ?? 'This month'}
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,.7)', mt: 0.5 }}>
          {people.length > 0
            ? `${people.length} ${people.length === 1 ? 'person' : 'people'} to celebrate`
            : 'Everything happening across the company'}
        </Typography>

        {showRing && <CelebrationRing items={people} />}
      </Box>

      <DialogContent sx={{ pt: 2.5 }}>
        {loading && <LoadingState rows={3} label="Loading this month's highlights" />}
        {!loading && error && <ErrorState message={error} />}
        {!loading && !error && (data?.items.length ?? 0) === 0 && (
          <EmptyState
            title="Nothing this month"
            description="No birthdays, anniversaries, holidays or company events fall in this month."
          />
        )}
        {!loading && !error && (data?.items.length ?? 0) > 0 && (
          <Stack spacing={1.25}>
            {data!.items.map((item, index) => {
              const tone = tones[item.type];
              const Icon = icons[item.type];

              return (
                <Stack
                  key={`${item.type}-${item.title}-${index}`}
                  direction="row"
                  spacing={1.75}
                  alignItems="center"
                  sx={{ p: 1.25, borderRadius: 3, border: `1px solid ${palette.line}` }}
                >
                  {item.profileImageUrl ? (
                    <Avatar src={item.profileImageUrl} alt="" sx={{ width: 42, height: 42 }} />
                  ) : (
                    <Box
                      sx={{
                        width: 42,
                        height: 42,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        color: tone.color,
                        background: tone.background,
                      }}
                    >
                      <Icon fontSize="small" />
                    </Box>
                  )}

                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography fontWeight={600} noWrap>
                      {item.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {item.subtitle}
                    </Typography>
                  </Box>

                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                    <Typography variant="body2" fontWeight={600} sx={{ color: tone.color }}>
                      {formatDayMonth(item.date)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {tone.label}
                    </Typography>
                  </Box>
                </Stack>
              );
            })}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Slowly rotating ring of avatars. Purely decorative, so it is hidden from assistive tech. */
function CelebrationRing({ items }: { items: Highlight[] }) {
  const visible = items.slice(0, 8);
  const radius = 92;

  return (
    <Box
      aria-hidden
      sx={{
        position: 'relative',
        height: radius * 2 + 64,
        display: 'grid',
        placeItems: 'center',
        '@keyframes hrm-orbit': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
        '@keyframes hrm-counter-orbit': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(-360deg)' } },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          width: radius * 2,
          height: radius * 2,
          borderRadius: '50%',
          border: '1px dashed rgba(255,255,255,.18)',
        }}
      />

      <Box
        sx={{
          position: 'absolute',
          width: radius * 2,
          height: radius * 2,
          // A slow, unobtrusive rotation: one turn every 40 seconds.
          animation: 'hrm-orbit 40s linear infinite',
        }}
      >
        {visible.map((item, index) => {
          const angle = (index / visible.length) * 2 * Math.PI;
          const x = radius + radius * Math.sin(angle) - 24;
          const y = radius - radius * Math.cos(angle) - 24;

          return (
            <Box
              key={`${item.title}-${index}`}
              sx={{
                position: 'absolute',
                left: x,
                top: y,
                // Counter-rotate so faces and initials stay upright as the ring turns.
                animation: 'hrm-counter-orbit 40s linear infinite',
              }}
            >
              <Avatar
                src={item.profileImageUrl ?? undefined}
                sx={{
                  width: 48,
                  height: 48,
                  border: '2px solid rgba(255,255,255,.55)',
                  background: item.type === 'Birthday' ? '#c2417a' : palette.success,
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                {initials(item.title)}
              </Avatar>
            </Box>
          );
        })}
      </Box>

      <Box sx={{ textAlign: 'center', color: '#fff' }}>
        <Typography variant="h3" sx={{ fontWeight: 800 }}>
          {items.length}
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.7)' }}>
          celebrations
        </Typography>
      </Box>
    </Box>
  );
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
