import { useEffect } from 'react'
import { Icon } from '../Icon/Icon'
import './ConfirmModal.css'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  subMessage?: string
  confirmLabel?: string
  cancelLabel?: string
  isDestructive?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  subMessage,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, loading, onCancel])

  if (!isOpen) return null

  return (
    <div className="confirm-modal-overlay" onClick={loading ? undefined : onCancel}>
      <div className="confirm-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-header">
          <div className="confirm-modal-title">
            <Icon name={isDestructive ? 'report' : 'mystery'} className="confirm-modal-icon" />
            <span>{title}</span>
          </div>
          <button
            type="button"
            className="confirm-modal-close"
            onClick={onCancel}
            disabled={loading}
            aria-label="Close"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="confirm-modal-body">
          <p className="confirm-modal-message">{message}</p>
          {subMessage && <p className="confirm-modal-submessage">{subMessage}</p>}
        </div>

        <div className="confirm-modal-actions">
          <button
            type="button"
            className="btn btn--dark"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${isDestructive ? 'btn--danger' : 'btn--accent'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            <Icon name={loading ? 'progress_activity' : isDestructive ? 'delete' : 'add'} />
            <span>{loading ? 'Processing...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
