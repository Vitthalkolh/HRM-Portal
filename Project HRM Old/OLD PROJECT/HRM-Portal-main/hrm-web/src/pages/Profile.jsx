import { useEffect, useRef, useState } from 'react'
import { authApi, leaveApi } from '../api/endpoints'
import { errorMessage } from '../api/client'
import { formatDate } from '../utils/format'
import BalanceCards from '../components/BalanceCards'
import Alert from '../components/Alert'
import Spinner from '../components/Spinner'

function Row({ label, value }) {
    return (
        <tr>
            <th style={{ width: 200 }}>{label}</th>
            <td>{value || '—'}</td>
        </tr>
    )
}

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function ProfilePicture({ profile, onUpload, onDelete, busy }) {
    const fileInputRef = useRef(null)
    const [previewUrl, setPreviewUrl] = useState(null)

    const currentUrl = previewUrl || profile?.profilePictureUrl

    function pickFile() {
        fileInputRef.current?.click()
    }

    function handleFileChange(event) {
        const file = event.target.files?.[0]
        event.target.value = '' // allow re-selecting the same file later
        if (!file) return

        if (!ALLOWED_TYPES.includes(file.type)) {
            onUpload(null, 'Please choose a JPEG, PNG, or WebP image.')
            return
        }
        if (file.size > MAX_FILE_SIZE) {
            onUpload(null, 'Image must be 2MB or smaller.')
            return
        }

        const localPreview = URL.createObjectURL(file)
        setPreviewUrl(localPreview)
        onUpload(file, null, () => {
            // called on failure, to revert the optimistic preview
            setPreviewUrl(null)
            URL.revokeObjectURL(localPreview)
        })
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div
                style={{
                    width: 84,
                    height: 84,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: '#e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }}
            >
                {currentUrl ? (
                    <img
                        src={currentUrl}
                        alt="Profile"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                ) : (
                    <span style={{ fontSize: 28, color: '#9ca3af' }}>
                        {(profile?.fullName || '?').charAt(0).toUpperCase()}
                    </span>
                )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={ALLOWED_TYPES.join(',')}
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={pickFile}
                    disabled={busy}
                >
                    {profile?.profilePictureUrl ? 'Change photo' : 'Upload photo'}
                </button>
                {profile?.profilePictureUrl && (
                    <button
                        type="button"
                        className="btn btn-danger"
                        onClick={onDelete}
                        disabled={busy}
                    >
                        Remove
                    </button>
                )}
            </div>
        </div>
    )
}

export default function Profile() {
    const [profile, setProfile] = useState(null)
    const [balances, setBalances] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [busy, setBusy] = useState(false)
    const [pictureBusy, setPictureBusy] = useState(false)

    const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })

    useEffect(() => {
        async function load() {
            try {
                const [meRes, balanceRes] = await Promise.all([
                    authApi.me(),
                    leaveApi.balance({ year: new Date().getFullYear() }),
                ])

                setProfile(meRes.data)
                setBalances(balanceRes.data)
            } catch (err) {
                setError(errorMessage(err, 'Could not load your profile.'))
            } finally {
                setLoading(false)
            }
        }

        load()
    }, [])

    async function handlePictureUpload(file, validationError, revertPreview) {
        setError('')
        setSuccess('')

        if (validationError) {
            setError(validationError)
            return
        }

        setPictureBusy(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            const res = await authApi.uploadProfilePicture(formData)
            setProfile((p) => ({ ...p, profilePictureUrl: res.data.profilePictureUrl }))
            setSuccess('Profile picture updated.')
        } catch (err) {
            revertPreview?.()
            setError(errorMessage(err, 'Could not upload profile picture.'))
        } finally {
            setPictureBusy(false)
        }
    }

    async function handlePictureDelete() {
        setError('')
        setSuccess('')
        setPictureBusy(true)
        try {
            await authApi.deleteProfilePicture()
            setProfile((p) => ({ ...p, profilePictureUrl: null }))
            setSuccess('Profile picture removed.')
        } catch (err) {
            setError(errorMessage(err, 'Could not remove profile picture.'))
        } finally {
            setPictureBusy(false)
        }
    }

    async function changePassword(event) {
        event.preventDefault()
        setError('')
        setSuccess('')

        if (passwords.next !== passwords.confirm) {
            setError('The new passwords do not match.')
            return
        }

        if (passwords.next.length < 8) {
            setError('The new password must be at least 8 characters.')
            return
        }

        setBusy(true)

        try {
            await authApi.changePassword(passwords.current, passwords.next)
            setSuccess('Password changed successfully.')
            setPasswords({ current: '', next: '', confirm: '' })
        } catch (err) {
            setError(errorMessage(err, 'Could not change your password.'))
        } finally {
            setBusy(false)
        }
    }

    if (loading) return <Spinner />

    return (
        <>
            <div className="page-head">
                <div>
                    <h2>My profile</h2>
                    <div className="subtitle">Your details and leave balance</div>
                </div>
            </div>

            <Alert type="error" onClose={() => setError('')}>
                {error}
            </Alert>
            <Alert type="success" onClose={() => setSuccess('')}>
                {success}
            </Alert>

            <BalanceCards balances={balances} />

            <div className="grid grid-2">
                <div className="card mb-0">
                    <div className="card-header">Employee details</div>
                    <div className="card-body">
                        <ProfilePicture
                            profile={profile}
                            onUpload={handlePictureUpload}
                            onDelete={handlePictureDelete}
                            busy={pictureBusy}
                        />
                    </div>
                    <div className="table-wrap">
                        <table className="data">
                            <tbody>
                                <Row label="Name" value={profile?.fullName} />
                                <Row label="Employee code" value={profile?.employeeCode} />
                                <Row label="Username" value={profile?.username} />
                                <Row label="Email" value={profile?.email} />
                                <Row label="Mobile" value={profile?.mobileNo} />
                                <Row label="City" value={profile?.city} />
                                <Row label="Designation" value={profile?.designation} />
                                <Row label="Department" value={profile?.department} />
                                <Row label="Reporting manager" value={profile?.reportingManagerName} />
                                <Row label="Date of birth" value={formatDate(profile?.dateOfBirth)} />
                                <Row label="Date of joining" value={formatDate(profile?.joiningDate)} />
                                <Row
                                    label="Company leaving date"
                                    value={
                                        profile?.companyLeavingDate
                                            ? formatDate(profile.companyLeavingDate)
                                            : 'Currently employed'
                                    }
                                />
                                <Row label="Role" value={profile?.isAdmin ? 'Administrator' : 'Employee'} />
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="card mb-0">
                    <div className="card-header">Change password</div>
                    <div className="card-body">
                        <form onSubmit={changePassword}>
                            <div style={{ marginBottom: 12 }}>
                                <label className="required">Current password</label>
                                <input
                                    type="password"
                                    value={passwords.current}
                                    autoComplete="current-password"
                                    onChange={(event) =>
                                        setPasswords((p) => ({ ...p, current: event.target.value }))
                                    }
                                    required
                                />
                            </div>
                            <div style={{ marginBottom: 12 }}>
                                <label className="required">New password</label>
                                <input
                                    type="password"
                                    value={passwords.next}
                                    minLength={8}
                                    autoComplete="new-password"
                                    onChange={(event) => setPasswords((p) => ({ ...p, next: event.target.value }))}
                                    required
                                />
                                <div className="hint">At least 8 characters.</div>
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <label className="required">Confirm new password</label>
                                <input
                                    type="password"
                                    value={passwords.confirm}
                                    minLength={8}
                                    autoComplete="new-password"
                                    onChange={(event) =>
                                        setPasswords((p) => ({ ...p, confirm: event.target.value }))
                                    }
                                    required
                                />
                            </div>

                            <button type="submit" className="btn btn-primary" disabled={busy}>
                                {busy ? 'Saving…' : 'Change password'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </>
    )
}