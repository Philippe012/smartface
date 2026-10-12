import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import { Alert } from '../../../components/ui/Feedback'
import { Field, Input, Textarea } from '../../../components/ui/Field'
import { api } from '../../../lib/api'
import { fromDateTimeLocal, toDateTimeLocal } from '../../../lib/format'
import { applyServerErrors } from '../../../lib/forms'
import type { AttendanceEvent } from '../../../types/api'
import { EmployeePicker } from './EmployeePicker'

const schema = z.object({
  employee_id: z.number({ message: 'Choose an employee.' }),
  occurred_at: z.string().min(1, 'Enter the arrival time.'),
  reason: z.string().trim().min(3, 'Explain why this is entered manually.'),
})
type Values = z.infer<typeof schema>

export function ManualEntryDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (e: AttendanceEvent) => void }) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { occurred_at: toDateTimeLocal(new Date()), reason: '' },
  })

  const close = () => {
    reset({ occurred_at: toDateTimeLocal(new Date()), reason: '' })
    setFormError(null)
    onClose()
  }

  const submit = async (values: Values) => {
    setFormError(null)
    try {
      const event = await api<AttendanceEvent>('/attendance/manual', {
        method: 'POST',
        body: { ...values, occurred_at: fromDateTimeLocal(values.occurred_at) },
      })
      onCreated(event)
      close()
    } catch (err) {
      setFormError(applyServerErrors(err, setError, ['employee_id', 'occurred_at', 'reason']))
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Record attendance manually"
      description="Manual fallback when the camera or recognition service is unavailable, or for employees using the alternative method."
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="manual-entry" loading={isSubmitting}>
            Record IN
          </Button>
        </>
      }
    >
      <form id="manual-entry" onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Field label="Employee" required error={errors.employee_id?.message}>
          {(p) => (
            <EmployeePicker
              {...p}
              value={watch('employee_id')}
              onChange={(id) => setValue('employee_id', id as number, { shouldValidate: true })}
            />
          )}
        </Field>
        <Field label="Arrival time" required error={errors.occurred_at?.message} hint="Your local time.">
          {(p) => <Input {...p} type="datetime-local" {...register('occurred_at')} />}
        </Field>
        <Field label="Reason" required error={errors.reason?.message} hint="Recorded in the audit log.">
          {(p) => <Textarea {...p} {...register('reason')} placeholder="e.g. Entrance camera offline from 07:30 to 09:00" />}
        </Field>
      </form>
    </Dialog>
  )
}
