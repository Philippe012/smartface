import { useState } from 'react'

import { Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import { Alert } from '../../../components/ui/Feedback'
import { Checkbox, Field, Input, Textarea } from '../../../components/ui/Field'
import { api, ApiError, errorMessage } from '../../../lib/api'
import { formatDateTime, fromDateTimeLocal, toDateTimeLocal } from '../../../lib/format'
import type { AttendanceEvent } from '../../../types/api'
import { EmployeePicker } from './EmployeePicker'

/** Resolve an uncertain/unknown observation: confirm as an employee, or reject. */
export function ReviewDialog({
  event,
  onClose,
  onDone,
}: {
  event: AttendanceEvent | null
  onClose: () => void
  onDone: (e: AttendanceEvent) => void
}) {
  const [employeeId, setEmployeeId] = useState<number | undefined>()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<'confirm' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastEventId, setLastEventId] = useState<number | null>(null)

  if (event && event.id !== lastEventId) {
    setLastEventId(event.id)
    setEmployeeId(event.candidate_employee?.id)
    setReason('')
    setError(null)
  }

  const decide = async (decision: 'confirm' | 'reject') => {
    if (!event) return
    if (!reason.trim()) return setError('Give a reason for your decision. It is recorded in the audit log.')
    if (decision === 'confirm' && !employeeId) return setError('Choose the employee shown in this observation.')
    setBusy(decision)
    setError(null)
    try {
      onDone(
        await api<AttendanceEvent>(`/attendance/${event.id}/review`, {
          method: 'POST',
          body: { decision, reason, employee_id: decision === 'confirm' ? employeeId : null },
        }),
      )
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog
      open={event !== null}
      onClose={onClose}
      title="Review observation"
      description={
        event &&
        `${event.match_status === 'uncertain' ? 'Uncertain match' : 'Unknown face'} at ${event.camera?.name ?? 'camera'}, ${formatDateTime(event.occurred_at)}${event.sighting_count > 1 ? ` (seen ${event.sighting_count} times)` : ''}.`
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy !== null}>
            Cancel
          </Button>
          <Button variant="danger-outline" onClick={() => decide('reject')} loading={busy === 'reject'} disabled={busy === 'confirm'}>
            Reject
          </Button>
          <Button onClick={() => decide('confirm')} loading={busy === 'confirm'} disabled={busy === 'reject'}>
            Confirm attendance
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Alert tone="info">
          Only confirm if you can verify who was there (for example, they are present now or another record shows
          it). The match score is a system signal, not proof of identity.
          {event?.candidate_employee &&
            ` Best candidate: ${event.candidate_employee.full_name} (score ${event.confidence?.toFixed(2)}).`}
        </Alert>
        <Field label="Employee (if confirming)">
          {(p) => <EmployeePicker {...p} value={employeeId} onChange={setEmployeeId} />}
        </Field>
        <Field label="Reason" required>
          {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Verified in person at reception" />}
        </Field>
      </div>
    </Dialog>
  )
}

/** Correct a confirmed record: change its time or void it. */
export function CorrectionDialog({
  event,
  open,
  onClose,
  onDone,
}: {
  event: AttendanceEvent
  open: boolean
  onClose: () => void
  onDone: (e: AttendanceEvent) => void
}) {
  const [time, setTime] = useState(toDateTimeLocal(event.occurred_at))
  const [voidIt, setVoidIt] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const submit = async () => {
    const errs: Record<string, string> = {}
    if (!reason.trim()) errs.reason = 'A reason is required.'
    if (!voidIt && !time) errs.occurred_at = 'Enter the corrected time.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    setFormError(null)
    try {
      onDone(
        await api<AttendanceEvent>(`/attendance/${event.id}/corrections`, {
          method: 'POST',
          body: voidIt ? { void: true, reason } : { occurred_at: fromDateTimeLocal(time), reason },
        }),
      )
      setReason('')
      onClose()
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
        setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, v]) => [k, v.join(' ')])))
        if (err.fieldErrors.detail || err.fieldErrors.non_field_errors) setFormError(err.message)
      } else {
        setFormError(errorMessage(err))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Correct attendance record"
      description="The original values, your change, your name and the reason are kept in the audit trail."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={voidIt ? 'danger' : 'primary'} onClick={submit} loading={busy}>
            {voidIt ? 'Void record' : 'Save correction'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Checkbox
          checked={voidIt}
          onChange={(e) => setVoidIt(e.target.checked)}
          label="Void this record"
          description="Use when the record belongs to someone else or should not exist."
        />
        {!voidIt && (
          <Field label="Corrected time" required error={errors.occurred_at}>
            {(p) => <Input {...p} type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} />}
          </Field>
        )}
        <Field label="Reason" required error={errors.reason}>
          {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
      </div>
    </Dialog>
  )
}
