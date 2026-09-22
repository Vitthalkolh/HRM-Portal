import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** Gate for authenticated routes; adminOnly additionally requires the Admin role. */
export default function ProtectedRoute({ children, adminOnly = false, employeeOnly = false }) {
  const { isAuthenticated, isAdmin } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/employee/dashboard" replace />
  }

  if (employeeOnly && isAdmin) {
    return <Navigate to="/admin/dashboard" replace />
  }

  return children
}
