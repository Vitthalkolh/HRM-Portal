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
import OptionalHoliday from './pages/leaves/OptionalHoliday'
import MyCalendar from './pages/leaves/MyCalendar'
import CompanyCalendar from './pages/leaves/CompanyCalendar'

import Approvals from './pages/admin/Approvals'
import OptionalApprovals from './pages/admin/OptionalApprovals'
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
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/directory" element={<Directory />} />
        <Route path="/holidays" element={<HolidayList />} />

        <Route path="/leaves/apply" element={<ApplyLeave />} />
        <Route path="/leaves/my" element={<MyLeaves />} />
        <Route path="/leaves/optional" element={<OptionalHoliday />} />

        <Route path="/calendar/my" element={<MyCalendar />} />
        <Route path="/calendar/company" element={<CompanyCalendar />} />

        <Route
          path="/admin/approvals"
          element={
            <ProtectedRoute adminOnly>
              <Approvals />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/optional-approvals"
          element={
            <ProtectedRoute adminOnly>
              <OptionalApprovals />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/employees"
          element={
            <ProtectedRoute adminOnly>
              <Employees />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/holidays"
          element={
            <ProtectedRoute adminOnly>
              <ManageHolidays />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
