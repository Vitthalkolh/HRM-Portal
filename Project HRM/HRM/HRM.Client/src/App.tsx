import { CssBaseline, ThemeProvider } from '@mui/material';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { ToastProvider } from './components/feedback';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ProtectedRoute, PublicOnlyRoute } from './auth/ProtectedRoute';
import { AdminDashboardPage } from './pages/AdminDashboard';
import { AdminEmployeesPage } from './pages/admin/Employees';
import { AdminLeaveRequestsPage } from './pages/admin/LeaveRequests';
import { ApplyLeavePage } from './pages/ApplyLeave';
import { CalendarPage } from './pages/Calendar';
import { ChangePasswordPage } from './pages/ChangePassword';
import { CompanyPlanningPage } from './pages/CompanyPlanning';
import { EmployeeDashboardPage } from './pages/EmployeeDashboard';
import { HolidaysPage } from './pages/Holidays';
import { LeaveHistoryPage } from './pages/LeaveHistory';
import { LeaveTypesPage } from './pages/LeaveTypes';
import { AuditLogsPage, NotFoundPage, SettingsPage } from './pages/Misc';
import { ProfilePage } from './pages/Profile';
import { ReferralsPage, ReimbursementsPage, SalarySlipsPage } from './pages/Services';
import { LoginPage } from './pages/auth/Login';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/auth/PasswordRecovery';
import { theme } from './theme';

/** Sends "/" to the dashboard that matches the signed-in role. */
function HomeRedirect() {
  const { user, isAuthenticated, initialising } = useAuth();
  if (initialising) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={user?.role === 'Admin' ? '/admin/dashboard' : '/employee/dashboard'} replace />;
}

export function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Signed-out pages. A signed-in user is redirected away from these. */}
              <Route element={<PublicOnlyRoute />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
              </Route>

              {/* Everything below requires a session. The API enforces this independently. */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<HomeRedirect />} />

                  <Route path="/employee/dashboard" element={<EmployeeDashboardPage />} />
                  <Route path="/employee/leave/apply" element={<ApplyLeavePage />} />
                  <Route path="/employee/leave/history" element={<LeaveHistoryPage />} />

                  {/* Shared by both roles. */}
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/company-planning" element={<CompanyPlanningPage />} />
                  <Route path="/leave-types" element={<LeaveTypesPage />} />
                  <Route path="/holidays" element={<HolidaysPage />} />
                  <Route path="/salary-slips" element={<SalarySlipsPage />} />
                  <Route path="/reimbursements" element={<ReimbursementsPage />} />
                  <Route path="/referrals" element={<ReferralsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/change-password" element={<ChangePasswordPage />} />
                  <Route path="/settings" element={<SettingsPage />} />

                  {/* Administrator-only. */}
                  <Route element={<ProtectedRoute adminOnly />}>
                    <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
                    <Route path="/admin/employees" element={<AdminEmployeesPage />} />
                    <Route path="/admin/leave-requests" element={<AdminLeaveRequestsPage />} />
                    <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
                  </Route>

                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Route>
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
