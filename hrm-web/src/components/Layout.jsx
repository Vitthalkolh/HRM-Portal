import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const EMPLOYEE_LINKS = [
  { to: '/dashboard', icon: '⌂', label: 'Dashboard' },
  { to: '/leaves/apply', icon: '✎', label: 'Apply Leave' },
  { to: '/leaves/my', icon: '☰', label: 'My Leaves' },
  { to: '/leaves/optional', icon: '★', label: 'Optional Holiday' },
  { to: '/calendar/my', icon: '▦', label: 'My Calendar' },
  { to: '/calendar/company', icon: '▩', label: 'Company Calendar' },
  { to: '/holidays', icon: '⚑', label: 'Holiday List' },
  { to: '/directory', icon: '☻', label: 'Employee Directory' },
  { to: '/profile', icon: '☺', label: 'My Profile' },
]

const ADMIN_LINKS = [
  { to: '/admin/approvals', icon: '✓', label: 'Leave Approvals' },
  { to: '/admin/optional-approvals', icon: '✦', label: 'Optional Holidays' },
  { to: '/admin/employees', icon: '⚇', label: 'Manage Employees' },
  { to: '/admin/holidays', icon: '⚐', label: 'Manage Holidays' },
]

function initials(name) {
  if (!name) return '?'

  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export default function Layout() {
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="layout">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span className="logo">HR</span>
          HRM Portal
        </div>

        <div className="sidebar-section">Employee</div>
        {EMPLOYEE_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setOpen(false)}
          >
            <span className="icon">{link.icon}</span>
            {link.label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="sidebar-section">Administration</div>
            {ADMIN_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => setOpen(false)}
              >
                <span className="icon">{link.icon}</span>
                {link.label}
              </NavLink>
            ))}
          </>
        )}

        <div style={{ marginTop: 'auto' }}>
          <div className="sidebar-link" onClick={handleLogout}>
            <span className="icon">⏻</span>
            Sign out
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              className="menu-toggle"
              onClick={() => setOpen((value) => !value)}
              aria-label="Toggle navigation"
            >
              ☰
            </button>
            <span className="topbar-title">PromptCloud Technologies Private Limited</span>
          </div>

          <div className="topbar-user">
            <span className="role-pill">{isAdmin ? 'Administrator' : 'Employee'}</span>
            <span>{user?.fullName}</span>
            <span className="avatar">{initials(user?.fullName)}</span>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
