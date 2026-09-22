import { Box, Stack, Typography } from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import type { ReactNode } from 'react';

/**
 * Shared two-panel frame for the signed-out pages: dark navy brand panel on the left,
 * white rounded card on the right. On small screens the brand panel collapses to a header.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1.05fr .95fr' },
        background: '#0b1030',
      }}
    >
      <Box
        sx={{
          px: { xs: 3, md: 8, lg: 11 },
          py: { xs: 5, md: 8 },
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background:
            'radial-gradient(circle at 18% 18%, rgba(102,85,232,.42), transparent 42%), linear-gradient(135deg, #090d28, #23175c)',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: { xs: 3, md: 6 } }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 2,
              background: '#6655e8',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
              fontSize: 18,
            }}
          >
            H
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: 19 }}>HRM</Typography>
        </Stack>

        <Typography variant="overline" sx={{ color: '#cbbfff' }}>
          PEOPLE OPERATIONS, SIMPLIFIED
        </Typography>

        <Typography
          sx={{
            fontSize: { xs: 38, md: 60, lg: 68 },
            fontWeight: 800,
            letterSpacing: '-.045em',
            lineHeight: 1.05,
            my: 2,
          }}
        >
          Work flows better
          <br />
          when people do.
        </Typography>

        <Typography sx={{ color: '#c8c9de', fontSize: 17, maxWidth: 470 }}>
          One thoughtful place for leave, the company calendar, release planning and the moments
          that matter to your team.
        </Typography>

        <Stack
          direction="row"
          spacing={3}
          sx={{ mt: { xs: 4, md: 7 }, display: { xs: 'none', md: 'flex' }, color: 'rgba(255,255,255,.62)' }}
        >
          {[
            { icon: <EventAvailableIcon fontSize="small" />, label: 'Leave & balances' },
            { icon: <CalendarMonthIcon fontSize="small" />, label: 'Common calendar' },
            { icon: <RocketLaunchIcon fontSize="small" />, label: 'Release planning' },
          ].map((feature) => (
            <Stack key={feature.label} direction="row" spacing={1} alignItems="center">
              {feature.icon}
              <Typography variant="body2">{feature.label}</Typography>
            </Stack>
          ))}
        </Stack>
      </Box>

      <Box
        sx={{
          display: 'grid',
          placeItems: 'center',
          p: { xs: 2.5, sm: 4 },
          background: '#f6f7fb',
        }}
      >
        <Box sx={{ width: 'min(440px, 100%)' }}>{children}</Box>
      </Box>
    </Box>
  );
}
