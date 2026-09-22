import { http, unwrap, unwrapWithMessage } from './client';
import type {
  AdminDashboard,
  ApiResponse,
  AuditLog,
  CalendarEvent,
  EmployeeDashboard,
  EmployeeDetail,
  EmployeeDirectoryItem,
  EmployeeListItem,
  ExpenseClaim,
  GeneratedPlanningPreview,
  Highlights,
  LeaveBalance,
  LeaveCreatePayload,
  LeaveDaysPreview,
  LeaveRequest,
  LeaveType,
  ManagementLeave,
  NationalHoliday,
  NotificationSummary,
  PagedResult,
  PlanningEvent,
  Referral,
  ReferralStatus,
  ReviewStatus,
  SalarySlip,
  TokenResponse,
  User,
} from './types';

type Json<T> = Promise<{ data: ApiResponse<T> }>;

// ---------------------------------------------------------------- auth

export const authApi = {
  login: (login: string, password: string, rememberMe: boolean) =>
    unwrap<TokenResponse>(http.post('/api/auth/login', { login, password, rememberMe }) as Json<TokenResponse>),

  logout: (refreshToken: string) => http.post('/api/auth/logout', { refreshToken }),

  me: () => unwrap<User>(http.get('/api/auth/me') as Json<User>),

  forgotPassword: (email: string) =>
    unwrapWithMessage<null>(http.post('/api/auth/forgot-password', { email }) as Json<null>),

  resetPassword: (token: string, newPassword: string, confirmPassword: string) =>
    unwrapWithMessage<null>(
      http.post('/api/auth/reset-password', { token, newPassword, confirmPassword }) as Json<null>,
    ),

  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) =>
    unwrapWithMessage<null>(
      http.post('/api/auth/change-password', { currentPassword, newPassword, confirmPassword }) as Json<null>,
    ),
};

// ---------------------------------------------------------------- employees & profile

export const employeeApi = {
  me: () => unwrap<EmployeeDetail>(http.get('/api/employees/me') as Json<EmployeeDetail>),

  updateMe: (payload: {
    firstName: string;
    lastName: string;
    phone: string | null;
    location: string | null;
    dateOfBirth: string | null;
  }) => unwrapWithMessage<EmployeeDetail>(http.put('/api/employees/me', payload) as Json<EmployeeDetail>),

  uploadProfileImage: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return unwrapWithMessage<{ profileImageUrl: string }>(
      http.post('/api/employees/me/profile-image', form) as Json<{ profileImageUrl: string }>,
    );
  },

  deleteProfileImage: () =>
    unwrapWithMessage<null>(http.delete('/api/employees/me/profile-image') as Json<null>),

  directory: (search?: string) =>
    unwrap<EmployeeDirectoryItem[]>(
      http.get('/api/employees/directory', { params: { search } }) as Json<EmployeeDirectoryItem[]>,
    ),

  list: (params: { search?: string; activeOnly?: boolean; page?: number; pageSize?: number }) =>
    unwrap<PagedResult<EmployeeListItem>>(
      http.get('/api/employees', { params }) as Json<PagedResult<EmployeeListItem>>,
    ),

  get: (id: number) => unwrap<EmployeeDetail>(http.get(`/api/employees/${id}`) as Json<EmployeeDetail>),

  create: (payload: Record<string, unknown>) =>
    unwrapWithMessage<EmployeeDetail>(http.post('/api/employees', payload) as Json<EmployeeDetail>),

  update: (id: number, payload: Record<string, unknown>) =>
    unwrapWithMessage<EmployeeDetail>(http.put(`/api/employees/${id}`, payload) as Json<EmployeeDetail>),

  resetPassword: (id: number, newPassword: string, requireChangeOnNextLogin: boolean) =>
    unwrapWithMessage<null>(
      http.post(`/api/employees/${id}/reset-password`, { newPassword, requireChangeOnNextLogin }) as Json<null>,
    ),

  deactivate: (id: number) => unwrapWithMessage<null>(http.post(`/api/employees/${id}/deactivate`) as Json<null>),

  activate: (id: number) => unwrapWithMessage<null>(http.post(`/api/employees/${id}/activate`) as Json<null>),
};

// ---------------------------------------------------------------- leave

export const leaveApi = {
  types: () => unwrap<LeaveType[]>(http.get('/api/leaves/types') as Json<LeaveType[]>),

  balance: (year?: number, employeeId?: number) =>
    unwrap<LeaveBalance[]>(http.get('/api/leaves/balance', { params: { year, employeeId } }) as Json<LeaveBalance[]>),

  history: (params: { status?: string; employeeId?: number; page?: number; pageSize?: number }) =>
    unwrap<PagedResult<LeaveRequest>>(
      http.get('/api/leaves/history', { params }) as Json<PagedResult<LeaveRequest>>,
    ),

  preview: (fromDate: string, toDate: string | null, isHalfDay: boolean) =>
    unwrap<LeaveDaysPreview>(
      http.post('/api/leaves/preview', { fromDate, toDate, isHalfDay }) as Json<LeaveDaysPreview>,
    ),

  apply: (payload: LeaveCreatePayload) =>
    unwrapWithMessage<LeaveRequest>(http.post('/api/leaves', payload) as Json<LeaveRequest>),

  approve: (id: number, comment?: string) =>
    unwrapWithMessage<LeaveRequest>(http.post(`/api/leaves/${id}/approve`, { comment }) as Json<LeaveRequest>),

  reject: (id: number, comment?: string) =>
    unwrapWithMessage<LeaveRequest>(http.post(`/api/leaves/${id}/reject`, { comment }) as Json<LeaveRequest>),

  cancel: (id: number, comment?: string) =>
    unwrapWithMessage<LeaveRequest>(http.post(`/api/leaves/${id}/cancel`, { comment }) as Json<LeaveRequest>),

  withdraw: (id: number) =>
    unwrapWithMessage<LeaveRequest>(http.post(`/api/leaves/${id}/withdraw`) as Json<LeaveRequest>),
};

// ---------------------------------------------------------------- calendar & company events

export const calendarApi = {
  events: (start: string, end: string) =>
    unwrap<CalendarEvent[]>(http.get('/api/calendar', { params: { start, end } }) as Json<CalendarEvent[]>),

  highlights: (year: number, month: number) =>
    unwrap<Highlights>(http.get('/api/calendar/highlights', { params: { year, month } }) as Json<Highlights>),
};

export const holidayApi = {
  list: (year: number) =>
    unwrap<NationalHoliday[]>(http.get('/api/national-holidays', { params: { year } }) as Json<NationalHoliday[]>),

  create: (payload: { name: string; date: string; description: string | null }) =>
    unwrapWithMessage<NationalHoliday>(http.post('/api/national-holidays', payload) as Json<NationalHoliday>),

  update: (id: number, payload: { name: string; date: string; description: string | null }) =>
    unwrapWithMessage<NationalHoliday>(http.put(`/api/national-holidays/${id}`, payload) as Json<NationalHoliday>),

  remove: (id: number) => unwrapWithMessage<null>(http.delete(`/api/national-holidays/${id}`) as Json<null>),
};

export const managementLeaveApi = {
  list: (year: number) =>
    unwrap<ManagementLeave[]>(http.get('/api/management-leaves', { params: { year } }) as Json<ManagementLeave[]>),

  create: (payload: { title: string; date: string; description: string | null }) =>
    unwrapWithMessage<ManagementLeave>(http.post('/api/management-leaves', payload) as Json<ManagementLeave>),

  update: (id: number, payload: { title: string; date: string; description: string | null }) =>
    unwrapWithMessage<ManagementLeave>(http.put(`/api/management-leaves/${id}`, payload) as Json<ManagementLeave>),

  remove: (id: number) => unwrapWithMessage<null>(http.delete(`/api/management-leaves/${id}`) as Json<null>),
};

export const planningApi = {
  list: (start?: string, end?: string, type?: string) =>
    unwrap<PlanningEvent[]>(http.get('/api/company-planning', { params: { start, end, type } }) as Json<PlanningEvent[]>),

  create: (payload: Record<string, unknown>) =>
    unwrapWithMessage<PlanningEvent>(http.post('/api/company-planning', payload) as Json<PlanningEvent>),

  update: (id: number, payload: Record<string, unknown>) =>
    unwrapWithMessage<PlanningEvent>(http.put(`/api/company-planning/${id}`, payload) as Json<PlanningEvent>),

  remove: (id: number) => unwrapWithMessage<null>(http.delete(`/api/company-planning/${id}`) as Json<null>),

  preview: (year: number, firstNtnsDate: string | null) =>
    unwrap<GeneratedPlanningPreview>(
      http.post('/api/company-planning/generate/preview', { year, firstNtnsDate }) as Json<GeneratedPlanningPreview>,
    ),

  generate: (year: number, firstNtnsDate: string | null, replace: boolean) =>
    unwrapWithMessage<GeneratedPlanningPreview>(
      http.post('/api/company-planning/generate', { year, firstNtnsDate, replace }) as Json<GeneratedPlanningPreview>,
    ),
};

// ---------------------------------------------------------------- dashboards

export const dashboardApi = {
  admin: () => unwrap<AdminDashboard>(http.get('/api/dashboard/admin') as Json<AdminDashboard>),
  employee: () => unwrap<EmployeeDashboard>(http.get('/api/dashboard/employee') as Json<EmployeeDashboard>),
};

// ---------------------------------------------------------------- services

export const salaryApi = {
  list: (employeeId?: number, year?: number) =>
    unwrap<SalarySlip[]>(http.get('/api/salary-slips', { params: { employeeId, year } }) as Json<SalarySlip[]>),

  downloadUrl: (id: number) => `/api/salary-slips/${id}/download`,

  upload: (employeeId: number, year: number, month: number, file: File) => {
    const form = new FormData();
    form.append('employeeId', String(employeeId));
    form.append('year', String(year));
    form.append('month', String(month));
    form.append('file', file);
    return unwrapWithMessage<null>(http.post('/api/salary-slips', form) as Json<null>);
  },

  remove: (id: number) => unwrapWithMessage<null>(http.delete(`/api/salary-slips/${id}`) as Json<null>),
};

export const reimbursementApi = {
  list: (params: { status?: string; page?: number; pageSize?: number }) =>
    unwrap<PagedResult<ExpenseClaim>>(
      http.get('/api/reimbursements', { params }) as Json<PagedResult<ExpenseClaim>>,
    ),

  create: (payload: Record<string, unknown>) =>
    unwrapWithMessage<ExpenseClaim>(http.post('/api/reimbursements', payload) as Json<ExpenseClaim>),

  update: (id: number, payload: Record<string, unknown>) =>
    unwrapWithMessage<ExpenseClaim>(http.put(`/api/reimbursements/${id}`, payload) as Json<ExpenseClaim>),

  review: (id: number, status: ReviewStatus, adminNotes: string | null) =>
    unwrapWithMessage<ExpenseClaim>(
      http.post(`/api/reimbursements/${id}/review`, { status, adminNotes }) as Json<ExpenseClaim>,
    ),

  remove: (id: number) => unwrapWithMessage<null>(http.delete(`/api/reimbursements/${id}`) as Json<null>),

  uploadAttachment: (id: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return unwrapWithMessage<{ attachmentFileId: number }>(
      http.post(`/api/reimbursements/${id}/attachment`, form) as Json<{ attachmentFileId: number }>,
    );
  },

  attachmentUrl: (id: number) => `/api/reimbursements/${id}/attachment`,
};

export const referralApi = {
  list: (params: { status?: string; page?: number; pageSize?: number }) =>
    unwrap<PagedResult<Referral>>(http.get('/api/referrals', { params }) as Json<PagedResult<Referral>>),

  create: (payload: Record<string, unknown>) =>
    unwrapWithMessage<Referral>(http.post('/api/referrals', payload) as Json<Referral>),

  review: (id: number, status: ReferralStatus, internalNotes: string | null) =>
    unwrapWithMessage<Referral>(http.post(`/api/referrals/${id}/review`, { status, internalNotes }) as Json<Referral>),

  uploadResume: (id: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return unwrapWithMessage<{ resumeFileId: number }>(
      http.post(`/api/referrals/${id}/resume`, form) as Json<{ resumeFileId: number }>,
    );
  },

  resumeUrl: (id: number) => `/api/referrals/${id}/resume`,
};

// ---------------------------------------------------------------- notifications & audit

export const notificationApi = {
  list: (params: { unreadOnly?: boolean; page?: number; pageSize?: number } = {}) =>
    unwrap<NotificationSummary>(http.get('/api/notifications', { params }) as Json<NotificationSummary>),

  unreadCount: () => unwrap<number>(http.get('/api/notifications/unread-count') as Json<number>),

  markRead: (id: number) => http.post(`/api/notifications/${id}/read`),

  markAllRead: () => unwrapWithMessage<null>(http.post('/api/notifications/read-all') as Json<null>),
};

export const auditApi = {
  list: (params: { module?: string; action?: string; page?: number; pageSize?: number }) =>
    unwrap<PagedResult<AuditLog>>(http.get('/api/audit-logs', { params }) as Json<PagedResult<AuditLog>>),

  modules: () => unwrap<string[]>(http.get('/api/audit-logs/modules') as Json<string[]>),
};

/**
 * Downloads a protected file through the authenticated client, so the browser never requests
 * a storage path directly and the Authorization header is always sent.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const response = await http.get(url, { responseType: 'blob' });
  const href = URL.createObjectURL(response.data as Blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}
