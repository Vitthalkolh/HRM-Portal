import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import Directory from './pages/Directory'
import HolidayList from './pages/HolidayList'

import ApplyLeave from './pages/leaves/ApplyLeave'
import MyLeaves from './pages/leaves/MyLeaves'
import CompanyCalendar from './pages/leaves/CompanyCalendar'

import Approvals from './pages/admin/Approvals'
import Employees from './pages/admin/Employees'
import ManageHolidays from './pages/admin/ManageHolidays'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/employee/dashboard" element={<ProtectedRoute employeeOnly><Dashboard /></ProtectedRoute>} />
        <Route path="/employee/profile" element={<ProtectedRoute employeeOnly><Profile /></ProtectedRoute>} />
        <Route path="/employee/directory" element={<ProtectedRoute employeeOnly><Directory /></ProtectedRoute>} />
        <Route path="/employee/holidays" element={<ProtectedRoute employeeOnly><HolidayList /></ProtectedRoute>} />
        <Route path="/employee/leave" element={<ProtectedRoute employeeOnly><ApplyLeave /></ProtectedRoute>} />
        <Route path="/employee/leave/history" element={<ProtectedRoute employeeOnly><MyLeaves /></ProtectedRoute>} />
        <Route path="/employee/calendar" element={<ProtectedRoute employeeOnly><CompanyCalendar /></ProtectedRoute>} />

        <Route path="/admin/dashboard" element={<ProtectedRoute adminOnly><Dashboard /></ProtectedRoute>} />
        <Route path="/admin/calendar" element={<ProtectedRoute adminOnly><CompanyCalendar /></ProtectedRoute>} />
        <Route path="/admin/employees" element={<ProtectedRoute adminOnly><Employees /></ProtectedRoute>} />
        <Route path="/admin/holidays" element={<ProtectedRoute adminOnly><ManageHolidays /></ProtectedRoute>} />
        <Route path="/admin/leave-requests" element={<ProtectedRoute adminOnly><Approvals /></ProtectedRoute>} />

      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
