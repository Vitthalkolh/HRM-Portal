import { createTheme } from '@mui/material/styles';

/**
 * One design system for the whole product: dark navy sidebar, light grey canvas, white rounded
 * cards, purple accent, soft shadows. Every page composes these tokens rather than styling
 * itself, so the application reads as a single product.
 */
export const palette = {
  navy: '#0c1128',
  navySoft: '#151b3b',
  navyLine: 'rgba(255,255,255,.08)',
  purple: '#6655e8',
  purpleSoft: '#efecff',
  canvas: '#f6f7fb',
  ink: '#171a2b',
  muted: '#5b6077',
  faint: '#8b90a6',
  line: '#e8eaf2',
  success: '#12876f',
  warning: '#b7791f',
  danger: '#d1364a',
  info: '#2b6cb0',
} as const;

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: palette.purple, light: '#8b7cf0', dark: '#4c3cc4', contrastText: '#ffffff' },
    secondary: { main: palette.navy },
    success: { main: palette.success },
    warning: { main: palette.warning },
    error: { main: palette.danger },
    info: { main: palette.info },
    background: { default: palette.canvas, paper: '#ffffff' },
    text: { primary: palette.ink, secondary: palette.muted },
    divider: palette.line,
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    h1: { fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em' },
    h2: { fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em' },
    h3: { fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' },
    h4: { fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' },
    h5: { fontSize: 18, fontWeight: 700 },
    h6: { fontSize: 16, fontWeight: 700 },
    subtitle2: { fontWeight: 600 },
    body2: { fontSize: 14 },
    overline: { fontWeight: 700, letterSpacing: '.12em', fontSize: 11 },
    button: { fontWeight: 600, textTransform: 'none' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: palette.canvas },
        '*::-webkit-scrollbar': { width: 10, height: 10 },
        '*::-webkit-scrollbar-thumb': { background: '#cfd3e2', borderRadius: 8 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        elevation1: { boxShadow: '0 1px 2px rgba(16,24,40,.04), 0 8px 24px rgba(16,24,40,.06)' },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 1 },
      styleOverrides: {
        root: { border: `1px solid ${palette.line}`, borderRadius: 16 },
      },
    },
    MuiCardContent: {
      styleOverrides: { root: { padding: 22, '&:last-child': { paddingBottom: 22 } } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10, paddingInline: 18, paddingBlock: 9 },
        sizeLarge: { paddingBlock: 12, fontSize: 15 },
      },
    },
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 10, background: '#fff' },
      },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 600, borderRadius: 8 } },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: '.06em',
          textTransform: 'uppercase',
          color: palette.faint,
          background: '#fbfbfe',
          borderBottom: `1px solid ${palette.line}`,
        },
        root: { borderBottom: `1px solid ${palette.line}` },
      },
    },
    MuiTableRow: {
      styleOverrides: { root: { '&:last-child td': { borderBottom: 0 } } },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 18 } },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { fontWeight: 700, fontSize: 19, paddingBottom: 8 } },
    },
    MuiTooltip: {
      styleOverrides: { tooltip: { background: palette.navy, fontSize: 12, borderRadius: 8, padding: '6px 10px' } },
    },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: 12 } },
    },
    MuiTab: {
      styleOverrides: { root: { textTransform: 'none', fontWeight: 600, minHeight: 44 } },
    },
  },
});

/** Visual identity for each calendar/planning event type, used everywhere they are rendered. */
export const eventStyles: Record<string, { label: string; color: string; background: string }> = {
  NationalHoliday: { label: 'National holiday', color: '#b7791f', background: '#fff4e0' },
  ManagementLeave: { label: 'Management leave', color: '#7a5cc7', background: '#f2edff' },
  Leave: { label: 'Leave', color: '#2b6cb0', background: '#e7f0fb' },
  Birthday: { label: 'Birthday', color: '#c2417a', background: '#fdebf3' },
  WorkAnniversary: { label: 'Work anniversary', color: '#12876f', background: '#e4f6f1' },
  NoticePeriod: { label: 'Notice period', color: '#d1364a', background: '#fdeaec' },
  NT: { label: 'NTNS release', color: '#4c3cc4', background: '#ece9ff' },
  IT: { label: 'Dry run', color: '#b7791f', background: '#fff4e0' },
  SNU: { label: 'SNU release', color: '#12876f', background: '#e4f6f1' },
  E: { label: 'Company event', color: '#c2417a', background: '#fdebf3' },
};

export const eventStyle = (type: string) =>
  eventStyles[type] ?? { label: type, color: palette.muted, background: '#eef0f6' };
