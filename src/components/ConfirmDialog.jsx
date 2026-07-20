export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  isBusy = false,
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  return (
    <div className="confirm-backdrop" role="presentation" onClick={isBusy ? undefined : onCancel}>
      <section
        className={`confirm-dialog ${variant === 'danger' ? 'is-danger' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-icon" aria-hidden="true">
          {variant === 'danger' ? '!' : '✓'}
        </div>

        <div className="confirm-copy">
          <p className="modal-kicker">Please confirm</p>
          <h2 id="confirm-dialog-title">{title}</h2>
          {message && <p>{message}</p>}
        </div>

        <div className="confirm-actions">
          <button type="button" className="secondary" onClick={onCancel} disabled={isBusy}>
            {cancelText}
          </button>
          <button
            type="button"
            className={variant === 'danger' ? 'danger' : ''}
            onClick={onConfirm}
            disabled={isBusy}
            autoFocus
          >
            {isBusy ? 'Working…' : confirmText}
          </button>
        </div>
      </section>
    </div>
  );
}
