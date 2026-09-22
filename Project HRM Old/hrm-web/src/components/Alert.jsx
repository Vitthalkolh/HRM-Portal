export default function Alert({ type = 'info', children, onClose }) {
  if (!children) return null

  return (
    <div className={`alert alert-${type}`}>
      <div className="flex-between">
        <span>{children}</span>
        {onClose && (
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Dismiss">
            ×
          </button>
        )}
      </div>
    </div>
  )
}
