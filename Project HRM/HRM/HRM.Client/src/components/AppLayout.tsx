import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Popover,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DashboardIcon from '@mui/icons-material/SpaceDashboard';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import EventNoteIcon from '@mui/icons-material/EventNote';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import GroupIcon from '@mui/icons-material/Group';
import HistoryIcon from '@mui/icons-material/History';
import LockResetIcon from '@mui/icons-material/LockReset';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import PaymentsIcon from '@mui/icons-material/Payments';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SettingsIcon from '@mui/icons-material/Settings';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { notificationApi } from '../api/services';
import type { Notification } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { palette } from '../theme';
import { formatDateTime, initials } from '../utils/format';
import { useToast } from './feedback';
import { TrendingDialog } from './TrendingDialog';

const SIDEBAR_WIDTH = 256;

interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
}

interface NavSection {
  heading: string;
  items: NavItem[];
}

const adminNav: NavSection[] = [
  {
    heading: 'Overview',
    items: [
      { label: 'Dashboard', to: '/admin/dashboard', icon: <DashboardIcon /> },
      { label: 'Common calendar', to: '/calendar', icon: <CalendarMonthIcon /> },
      { label: 'Company planning', to: '/company-planning', icon: <RocketLaunchIcon /> },
    ],
  },
  {
    heading: 'People',
    items: [
      { label: 'Employees', to: '/admin/employees', icon: <GroupIcon /> },
      { label: 'Leave requests', to: '/admin/leave-requests', icon: <FactCheckIcon /> },
      { label: 'Leave types', to: '/leave-types', icon: <EventAvailableIcon /> },
      { label: 'Holidays', to: '/holidays', icon: <EventNoteIcon /> },
    ],
  },
  {
    heading: 'Services',
    items: [
      { label: 'Salary slips', to: '/salary-slips', icon: <PaymentsIcon /> },
      { label: 'Reimbursements', to: '/reimbursements', icon: <ReceiptLongIcon /> },
      { label: 'Referrals', to: '/referrals', icon: <AssignmentIndIcon /> },
    ],
  },
  {
    heading: 'Administration',
    items: [
      { label: 'Audit log', to: '/admin/audit-logs', icon: <AdminPanelSettingsIcon /> },
      { label: 'Settings', to: '/settings', icon: <SettingsIcon /> },
    ],
  },
];

const employeeNav: NavSection[] = [
  {
    heading: 'Overview',
    items: [
      { label: 'Dashboard', to: '/employee/dashboard', icon: <DashboardIcon /> },
      { label: 'Common calendar', to: '/calendar', icon: <CalendarMonthIcon /> },
      { label: 'Company planning', to: '/company-planning', icon: <RocketLaunchIcon /> },
    ],
  },
  {
    heading: 'My leave',
    items: [
      { label: 'Apply for leave', to: '/employee/leave/apply', icon: <EventAvailableIcon /> },
      { label: 'Leave history', to: '/employee/leave/history', icon: <HistoryIcon /> },
      { label: 'Leave types', to: '/leave-types', icon: <FactCheckIcon /> },
      { label: 'Holidays', to: '/holidays', icon: <EventNoteIcon /> },
    ],
  },
  {
    heading: 'Services',
    items: [
      { label: 'Salary slips', to: '/salary-slips', icon: <PaymentsIcon /> },
      { label: 'Reimbursements', to: '/reimbursements', icon: <ReceiptLongIcon /> },
      { label: 'Referrals', to: '/referrals', icon: <AssignmentIndIcon /> },
    ],
  },
  {
    heading: 'Account',
    items: [
      { label: 'My profile', to: '/profile', icon: <PersonOutlineIcon /> },
      { label: 'Settings', to: '/settings', icon: <SettingsIcon /> },
    ],
  },
];

export function AppLayout() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const location = useLocation();
  const { isAdmin } = useAuth();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const sections = isAdmin ? adminNav : employeeNav;

  // Navigating on a small screen should close the drawer behind you.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const sidebar = <SidebarContent sections={sections} />;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', background: palette.canvas }}>
      {isDesktop ? (
        <Drawer
          variant="permanent"
          sx={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: SIDEBAR_WIDTH,
              background: palette.navy,
              color: '#fff',
              border: 0,
            },
          }}
        >
          {sidebar}
        </Drawer>
      ) : (
        <Drawer
          variant="temporary"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH, background: palette.navy, color: '#fff', border: 0 },
          }}
        >
          {sidebar}
        </Drawer>
      )}

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopBar onOpenMenu={() => setDrawerOpen(true)} showMenuButton={!isDesktop} />
        <Box component="main" sx={{ p: { xs: 2, sm: 3, lg: 4 }, flex: 1, minWidth: 0 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}

function SidebarContent({ sections }: { sections: NavSection[] }) {
  const { user } = useAuth();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ px: 3, py: 2.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: 2,
              background: palette.purple,
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
            }}
          >
            H
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, lineHeight: 1.1 }}>HRM</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.5)' }}>
              {user?.role === 'Admin' ? 'Administrator' : 'Employee'} workspace
            </Typography>
          </Box>
        </Stack>
      </Toolbar>

      <Box sx={{ flex: 1, overflowY: 'auto', pb: 2 }}>
        {sections.map((section) => (
          <List
            key={section.heading}
            dense
            subheader={
              <ListSubheader
                disableSticky
                sx={{
                  background: 'transparent',
                  color: 'rgba(255,255,255,.38)',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                  lineHeight: '30px',
                  px: 3,
                }}
              >
                {section.heading}
              </ListSubheader>
            }
            sx={{ px: 1.5 }}
          >
            {section.items.map((item) => (
              <ListItemButton
                key={item.to}
                component={NavLink}
                to={item.to}
                sx={{
                  borderRadius: 2.5,
                  mb: 0.25,
                  px: 1.75,
                  color: 'rgba(255,255,255,.72)',
                  '& .MuiListItemIcon-root': { color: 'inherit', minWidth: 36 },
                  '&:hover': { background: 'rgba(255,255,255,.06)', color: '#fff' },
                  '&.active': {
                    background: palette.purple,
                    color: '#fff',
                    boxShadow: '0 8px 20px rgba(102,85,232,.35)',
                  },
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.label}
                  slotProps={{ primary: { fontSize: 14, fontWeight: 600 } }}
                />
              </ListItemButton>
            ))}
          </List>
        ))}
      </Box>

      <Box sx={{ p: 2.5, borderTop: `1px solid ${palette.navyLine}` }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.4)' }}>
          Signed in as
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {user?.fullName}
        </Typography>
      </Box>
    </Box>
  );
}

function TopBar({ onOpenMenu, showMenuButton }: { onOpenMenu: () => void; showMenuButton: boolean }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { notify } = useToast();

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [trendingOpen, setTrendingOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    setMenuAnchor(null);
    await signOut();
    notify('You have been signed out.', 'info');
    navigate('/login', { replace: true });
  };

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        color="inherit"
        sx={{ background: '#fff', borderBottom: `1px solid ${palette.line}` }}
      >
        <Toolbar sx={{ gap: 1, px: { xs: 1.5, sm: 3 } }}>
          {showMenuButton && (
            <IconButton onClick={onOpenMenu} edge="start" aria-label="Open navigation">
              <MenuIcon />
            </IconButton>
          )}

          <Box sx={{ flex: 1 }} />

          <Tooltip title="Trending this month">
            <Button
              onClick={() => setTrendingOpen(true)}
              startIcon={<TrendingUpIcon />}
              sx={{
                color: palette.purple,
                background: palette.purpleSoft,
                '&:hover': { background: '#e5e0ff' },
                display: { xs: 'none', sm: 'inline-flex' },
              }}
            >
              Trending
            </Button>
          </Tooltip>
          <Tooltip title="Trending this month">
            <IconButton
              onClick={() => setTrendingOpen(true)}
              aria-label="Trending this month"
              sx={{ display: { xs: 'inline-flex', sm: 'none' }, color: palette.purple }}
            >
              <TrendingUpIcon />
            </IconButton>
          </Tooltip>

          <NotificationBell />

          <Button
            onClick={(event) => setMenuAnchor(event.currentTarget)}
            aria-label="Open account menu"
            sx={{ color: palette.ink, pl: 0.5, pr: { xs: 0.5, sm: 1.5 }, minWidth: 0 }}
          >
            <Avatar
              src={user?.profileImageUrl ?? undefined}
              sx={{ width: 34, height: 34, mr: { xs: 0, sm: 1.25 }, background: palette.purple, fontSize: 14 }}
            >
              {initials(user?.fullName ?? '')}
            </Avatar>
            <Box sx={{ textAlign: 'left', display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="body2" fontWeight={600} lineHeight={1.2} noWrap>
                {user?.fullName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.role}
              </Typography>
            </Box>
          </Button>

          <Menu
            anchorEl={menuAnchor}
            open={menuAnchor !== null}
            onClose={() => setMenuAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{ paper: { sx: { width: 248, borderRadius: 3, mt: 1 } } }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography fontWeight={700} noWrap>
                {user?.fullName}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {user?.email}
              </Typography>
              {user?.mustChangePassword && (
                <Chip size="small" color="warning" label="Password change due" sx={{ mt: 1 }} />
              )}
            </Box>
            <Divider />

            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                navigate('/profile');
              }}
            >
              <ListItemIcon>
                <PersonOutlineIcon fontSize="small" />
              </ListItemIcon>
              My profile
            </MenuItem>

            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                navigate('/change-password');
              }}
            >
              <ListItemIcon>
                <LockResetIcon fontSize="small" />
              </ListItemIcon>
              Change password
            </MenuItem>

            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                navigate('/settings');
              }}
            >
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              Settings
            </MenuItem>

            <Divider />

            <MenuItem onClick={handleSignOut} disabled={signingOut} sx={{ color: palette.danger }}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" sx={{ color: palette.danger }} />
              </ListItemIcon>
              {signingOut ? 'Signing out…' : 'Log out'}
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <TrendingDialog open={trendingOpen} onClose={() => setTrendingOpen(false)} />
    </>
  );
}

function NotificationBell() {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const summary = await notificationApi.list({ pageSize: 12 });
      setItems(summary.items);
      setUnread(summary.unreadCount);
    } catch {
      // A failing bell must never block the rest of the page.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // A gentle poll keeps the badge current without a websocket.
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const openMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchor(event.currentTarget);
    void load();
  };

  const openNotification = async (item: Notification) => {
    if (!item.isRead) {
      try {
        await notificationApi.markRead(item.id);
      } catch {
        /* Opening the link matters more than the read receipt. */
      }
    }
    setAnchor(null);
    void load();
    if (item.link) navigate(item.link);
  };

  const markAllRead = async () => {
    await notificationApi.markAllRead();
    void load();
  };

  const label = useMemo(
    () => (unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'),
    [unread],
  );

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton onClick={openMenu} aria-label={label}>
          <Badge badgeContent={unread} color="error" max={99}>
            <NotificationsNoneIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 380, maxWidth: '96vw', borderRadius: 3, mt: 1 } } }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5 }}>
          <Typography fontWeight={700}>Notifications</Typography>
          {unread > 0 && (
            <Button size="small" startIcon={<DoneAllIcon />} onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </Stack>
        <Divider />

        <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
          {loading && items.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
              Loading…
            </Typography>
          )}

          {!loading && items.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 4, textAlign: 'center' }}>
              You have no notifications yet.
            </Typography>
          )}

          {items.map((item) => (
            <Box
              key={item.id}
              onClick={() => void openNotification(item)}
              sx={{
                px: 2,
                py: 1.5,
                cursor: 'pointer',
                borderBottom: `1px solid ${palette.line}`,
                background: item.isRead ? 'transparent' : palette.purpleSoft,
                '&:hover': { background: '#f2f3f8' },
              }}
            >
              <Typography variant="body2" fontWeight={item.isRead ? 500 : 700}>
                {item.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {item.body}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDateTime(item.createdAtUtc)}
              </Typography>
            </Box>
          ))}
        </Box>
      </Popover>
    </>
  );
}
