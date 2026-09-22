import Modal from './Modal'

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  confirmClass = 'btn-primary',
  busy = false,
  onConfirm,
  onClose,
  children,
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      maxWidth={460}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${confirmClass}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      {message && <p className="mt-0">{message}</p>}
      {children}
    </Modal>
  )
}
