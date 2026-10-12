import { useState, type ReactNode } from 'react'

import { errorMessage } from '../../lib/api'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { Field, Textarea } from './Field'

/** Confirmation with an optional mandatory reason (recorded in the audit trail). */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  danger = false,
  requireReason = false,
  reasonLabel = 'Reason',
  children,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<void> | void
  title: string
  description?: ReactNode
  confirmLabel?: string
  danger?: boolean
  requireReason?: boolean
  reasonLabel?: string
  children?: ReactNode
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const close = () => {
    if (busy) return
    setReason('')
    setError(undefined)
    onClose()
  }

  const submit = async () => {
    if (requireReason && !reason.trim()) {
      setError('Please give a reason. It is recorded in the audit log.')
      return
    }
    setBusy(true)
    try {
      await onConfirm(reason.trim())
      setReason('')
      setError(undefined)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={submit} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
      {error && !requireReason && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      {requireReason && (
        <Field label={reasonLabel} required error={error} className={children ? 'mt-4' : undefined}>
          {(props) => <Textarea {...props} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />}
        </Field>
      )}
    </Dialog>
  )
}
