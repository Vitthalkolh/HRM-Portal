import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const EMPLOYEE_LINKS = [
    { to: '/employee/dashboard', icon: '⌂', label: 'Dashboard' },
    { to: '/employee/leave', icon: '✎', label: 'Apply Leave' },
    { to: '/employee/leave/history', icon: '☰', label: 'Leave History' },
    { to: '/employee/calendar', icon: '▦', label: 'Calendar' },
    { to: '/employee/holidays', icon: '⚑', label: 'National Holidays' },
    { to: '/employee/directory', icon: '☻', label: 'Employee Directory' },
    { to: '/employee/profile', icon: '☺', label: 'My Profile' },
]

const ADMIN_LINKS = [
    { to: '/admin/dashboard', icon: '⌂', label: 'Dashboard' },
    { to: '/admin/leave-requests', icon: '✓', label: 'Leave Requests' },
    { to: '/admin/employees', icon: '⚇', label: 'Manage Employees' },
    { to: '/admin/holidays', icon: '⚐', label: 'Manage Holidays' },
    { to: '/admin/calendar', icon: '▦', label: 'Calendar' },
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

                {!isAdmin && <div className="sidebar-section">Workspace</div>}
                {!isAdmin && EMPLOYEE_LINKS.map((link) => (
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
                        <span className="topbar-title">HRM Workspace</span>

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
