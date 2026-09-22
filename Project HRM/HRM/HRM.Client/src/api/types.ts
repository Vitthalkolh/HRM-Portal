/**
 * Client-side mirror of the server DTOs in HRM.Server/DTOs/Contracts.cs.
 * Field names match the JSON the API produces (camel-cased by ASP.NET Core).
 */

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]> | null;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export type Role = 'Admin' | 'Employee';

export interface User {
  id: number;
  userName: string;
  email: string;
  role: Role;
  fullName: string;
  employeeId: number | null;
  profileImageUrl: string | null;
  mustChangePassword: boolean;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresAtUtc: string;
  user: User;
}

export interface WorkingDuration {
  years: number;
  months: number;
  days: number;
  totalCalendarDays: number;
  totalWorkingDays: number;
}

export interface EmployeeListItem {
  id: number;
  employeeCode: string;
  fullName: string;
  email: string;
  department: string | null;
  designation: string | null;
  joiningDate: string;
  employmentStatus: EmploymentStatus;
  isActive: boolean;
  role: Role;
  profileImageUrl: string | null;
}

export type EmploymentStatus = 'Active' | 'NoticePeriod' | 'Resigned';

export interface EmployeeDetail {
  id: number;
  userId: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  userName: string;
  role: Role;
  phone: string | null;
  department: string | null;
  designation: string | null;
  location: string | null;
  joiningDate: string;
  dateOfBirth: string | null;
  employmentStatus: EmploymentStatus;
  resignationDate: string | null;
  lastWorkingDate: string | null;
  profileImageUrl: string | null;
  isActive: boolean;
  workingDuration: WorkingDuration;
}

export interface EmployeeDirectoryItem {
  id: number;
  employeeCode: string;
  fullName: string;
  department: string | null;
  designation: string | null;
  profileImageUrl: string | null;
}

export interface LeaveType {
  id: number;
  code: string;
  name: string;
  annualQuota: number;
  description: string;
  allowHalfDay: boolean;
}

export interface LeaveBalance {
  leaveTypeId: number;
  code: string;
  name: string;
  total: number;
  taken: number;
  pending: number;
  /** Total minus approved days: the figure shown to the employee. */
  remaining: number;
  /** Total minus approved and pending days: the figure used to validate a new request. */
  available: number;
}

export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled' | 'Withdrawn';

export interface LeaveRequest {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  leaveTypeId: number;
  leaveTypeCode: string;
  leaveTypeName: string;
  fromDate: string;
  toDate: string;
  isHalfDay: boolean;
  halfDaySession: string | null;
  days: number;
  reason: string;
  status: LeaveStatus;
  reviewComment: string | null;
  reviewedBy: string | null;
  reviewedAtUtc: string | null;
  appliedAtUtc: string;
}

export interface LeaveCreatePayload {
  leaveTypeId: number;
  durationMode: 'Single' | 'Multiple';
  fromDate: string;
  toDate: string | null;
  isHalfDay: boolean;
  halfDaySession: string | null;
  reason: string;
}

export interface LeaveDaysPreview {
  days: number;
  workingDates: string[];
  excluded: string[];
}

export interface NationalHoliday {
  id: number;
  name: string;
  date: string;
  description: string | null;
}

export interface ManagementLeave {
  id: number;
  title: string;
  date: string;
  description: string | null;
}

export type CalendarEventType =
  | 'NationalHoliday'
  | 'ManagementLeave'
  | 'Leave'
  | 'Birthday'
  | 'WorkAnniversary'
  | 'NoticePeriod';

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  start: string;
  end: string;
  description: string | null;
  employeeId: number | null;
  profileImageUrl: string | null;
}

export type PlanningType = 'NT' | 'IT' | 'SNU' | 'E';

export interface PlanningEvent {
  id: number;
  title: string;
  type: PlanningType;
  typeName: string;
  startDate: string;
  endDate: string;
  description: string | null;
  location: string | null;
  notes: string | null;
  isGenerated: boolean;
  isOverridden: boolean;
}

export interface GeneratedPlanningPreview {
  events: PlanningEvent[];
  cancelledSnu: string[];
}

export interface LeaveTypeUsage {
  code: string;
  name: string;
  approvedDays: number;
  requestCount: number;
}

export interface AdminDashboard {
  totalEmployees: number;
  activeEmployees: number;
  onLeaveToday: number;
  pendingLeaveRequests: number;
  approvedThisMonth: number;
  pendingReimbursements: number;
  pendingReferrals: number;
  upcomingBirthdays: number;
  upcomingAnniversaries: number;
  recentRequests: LeaveRequest[];
  leaveUsageByType: LeaveTypeUsage[];
}

export interface EmployeeDashboard {
  fullName: string;
  profileImageUrl: string | null;
  workingDuration: WorkingDuration;
  balances: LeaveBalance[];
  recentRequests: LeaveRequest[];
  upcomingEvents: CalendarEvent[];
  upcomingPlanning: PlanningEvent[];
  unreadNotifications: number;
}

export interface Highlight {
  type: 'Birthday' | 'WorkAnniversary' | 'NationalHoliday' | 'CompanyEvent';
  title: string;
  subtitle: string;
  date: string;
  profileImageUrl: string | null;
}

export interface Highlights {
  year: number;
  month: number;
  monthName: string;
  items: Highlight[];
}

export type ReviewStatus = 'Pending' | 'Approved' | 'Rejected';

export interface ExpenseClaim {
  id: number;
  employeeId: number;
  employeeName: string;
  expenseType: string;
  expenseDate: string;
  amount: number;
  description: string;
  referenceUrl: string | null;
  status: ReviewStatus;
  attachmentFileId: number | null;
  adminNotes: string | null;
  createdAtUtc: string;
}

export type ReferralStatus = 'Submitted' | 'Screening' | 'Interviewing' | 'Hired' | 'Rejected';

export interface Referral {
  id: number;
  employeeId: number;
  referredBy: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string | null;
  position: string;
  linkedInUrl: string | null;
  notes: string | null;
  resumeFileId: number | null;
  status: ReferralStatus;
  /** Administrators only; null for everyone else. */
  internalNotes: string | null;
  createdAtUtc: string;
}

export interface SalarySlip {
  id: number;
  employeeId: number;
  employeeName: string;
  year: number;
  month: number;
  monthName: string;
  sizeBytes: number;
  uploadedAtUtc: string;
}

export interface Notification {
  id: number;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  link: string | null;
  createdAtUtc: string;
}

export interface NotificationSummary {
  unreadCount: number;
  items: Notification[];
}

export interface AuditLog {
  id: number;
  userId: number | null;
  userName: string;
  action: string;
  module: string;
  entityId: string;
  details: string | null;
  ipAddress: string | null;
  createdAtUtc: string;
}
