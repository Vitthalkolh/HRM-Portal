import client from './client'

export const authApi = {
  login: (userName, password) => client.post('/auth/login', { userName, password }),
  me: () => client.get('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    client.post('/auth/change-password', { currentPassword, newPassword }),
}

export const userApi = {
  list: (includeInactive = false) =>
    client.get('/users', { params: { includeInactive } }),
  get: (id) => client.get(`/users/${id}`),
  create: (payload) => client.post('/users', payload),
  update: (id, payload) => client.put(`/users/${id}`, payload),
  deactivate: (id) => client.delete(`/users/${id}`),
  resetPassword: (id, newPassword) =>
    client.post(`/users/${id}/reset-password`, { newPassword }),
}

export const leaveApi = {
  types: (applicableOnly = true) =>
    client.get('/leave/types', { params: { applicableOnly } }),
  apply: (payload) => client.post('/leave', payload),
  list: (params = {}) => client.get('/leave', { params }),
  get: (id) => client.get(`/leave/${id}`),
  updateStatus: (id, statusId, rejectReason) =>
    client.put(`/leave/status/${id}`, { statusId, rejectReason }),
  cancel: (id) => client.put(`/leave/cancel/${id}`),
  balance: (params = {}) => client.get('/leave/balance', { params }),
  allocate: (params) => client.post('/leave/allocate', null, { params }),
}

export const holidayApi = {
  list: (params = {}) => client.get('/holiday', { params }),
  create: (payload) => client.post('/holiday', payload),
  remove: (id) => client.delete(`/holiday/${id}`),
  applyOptional: (holidayId) => client.post('/holiday/optional', { holidayId }),
  optionalRequests: (params = {}) => client.get('/holiday/optional', { params }),
  updateOptionalStatus: (id, statusId, rejectReason) =>
    client.put(`/holiday/optional/status/${id}`, { statusId, rejectReason }),
  cancelOptional: (id) => client.delete(`/holiday/optional/${id}`),
}

export const calendarApi = {
  company: (year, month) => client.get('/calendar/company', { params: { year, month } }),
  mine: (year, month) => client.get('/calendar/my', { params: { year, month } }),
}

export const dashboardApi = {
  summary: () => client.get('/dashboard/summary'),
  birthdays: (days = 30) => client.get('/dashboard/birthdays', { params: { days } }),
  anniversaries: (days = 30) => client.get('/dashboard/anniversaries', { params: { days } }),
}
