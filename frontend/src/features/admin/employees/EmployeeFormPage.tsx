import { zodResolver } from '@hookform/resolvers/zod'
import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router'
import { z } from 'zod'

import { Button, ButtonLink } from '../../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../../components/ui/Card'
import { Alert, ErrorState, LoadingBlock } from '../../../components/ui/Feedback'
import { Field, Input } from '../../../components/ui/Field'
import { PageHeader } from '../../../components/ui/PageHeader'
import { useToast } from '../../../components/ui/Toast'
import { useApi } from '../../../hooks/useApi'
import { api } from '../../../lib/api'
import { applyServerErrors } from '../../../lib/forms'
import type { Employee } from '../../../types/api'

const schema = z.object({
  employee_number: z.string().trim().min(1, 'Employee number is required.').max(32),
  first_name: z.string().trim().min(1, 'First name is required.').max(80),
  last_name: z.string().trim().min(1, 'Last name is required.').max(80),
  email: z.union([z.literal(''), z.email('Enter a valid email address.')]),
  phone: z.string().trim().max(32),
  department: z.string().trim().max(80),
  position: z.string().trim().max(80),
})
type Values = z.infer<typeof schema>
const FIELDS = Object.keys(schema.shape)

export function EmployeeFormPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()
  const [formError, setFormError] = useState<string | null>(null)
  const { data: employee, error, reload } = useApi<Employee>(editing ? `/employees/${id}` : null)
  const { data: departments } = useApi<string[]>('/employees/departments')

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { employee_number: '', first_name: '', last_name: '', email: '', phone: '', department: '', position: '' },
  })

  useEffect(() => {
    if (employee) {
      reset({
        employee_number: employee.employee_number,
        first_name: employee.first_name,
        last_name: employee.last_name,
        email: employee.email,
        phone: employee.phone,
        department: employee.department,
        position: employee.position,
      })
    }
  }, [employee, reset])

  const onSubmit = async (values: Values) => {
    setFormError(null)
    try {
      const saved = await api<Employee>(editing ? `/employees/${id}` : '/employees', {
        method: editing ? 'PATCH' : 'POST',
        body: values,
      })
      toast.success(editing ? 'Employee updated.' : `${saved.full_name} was added.`)
      navigate(`/admin/employees/${saved.id}`)
    } catch (err) {
      setFormError(applyServerErrors(err, setError, FIELDS))
    }
  }

  const title = editing ? 'Edit employee' : 'Add employee'
  const back = editing
    ? { to: `/admin/employees/${id}`, label: 'Back to employee' }
    : { to: '/admin/employees', label: 'Employees' }

  if (editing && !employee) {
    return (
      <>
        <PageHeader title={title} back={back} />
        <Card>{error ? <ErrorState error={error} onRetry={reload} /> : <LoadingBlock />}</Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={title}
        back={back}
        description={editing ? employee?.full_name : 'Create the employee record. Face enrollment happens in a separate, consented step.'}
      />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-3xl">
        <Card>
          <CardHeader title="Employee details" description="Keep only the information your attendance process needs." />
          <CardBody className="space-y-5">
            {formError && <Alert tone="danger">{formError}</Alert>}
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Employee number" required error={errors.employee_number?.message} hint="Unique identifier, e.g. EMP001">
                {(p) => <Input {...p} {...register('employee_number')} autoComplete="off" />}
              </Field>
              <div className="hidden sm:block" />
              <Field label="First name" required error={errors.first_name?.message}>
                {(p) => <Input {...p} {...register('first_name')} autoComplete="off" />}
              </Field>
              <Field label="Last name" required error={errors.last_name?.message}>
                {(p) => <Input {...p} {...register('last_name')} autoComplete="off" />}
              </Field>
              <Field label="Email" error={errors.email?.message} hint="Used for portal password recovery.">
                {(p) => <Input {...p} type="email" {...register('email')} autoComplete="off" />}
              </Field>
              <Field label="Phone" error={errors.phone?.message}>
                {(p) => <Input {...p} type="tel" {...register('phone')} autoComplete="off" />}
              </Field>
              <Field label="Department" error={errors.department?.message}>
                {(p) => <Input {...p} list="department-options" {...register('department')} autoComplete="off" />}
              </Field>
              <Field label="Position" error={errors.position?.message}>
                {(p) => <Input {...p} {...register('position')} autoComplete="off" />}
              </Field>
            </div>
            <datalist id="department-options">
              {departments?.map((d) => <option key={d} value={d} />)}
            </datalist>
          </CardBody>
          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
            <ButtonLink to={back.to} variant="secondary">
              Cancel
            </ButtonLink>
            <Button type="submit" icon={Save} loading={isSubmitting} disabled={editing && !isDirty}>
              {editing ? 'Save changes' : 'Create employee'}
            </Button>
          </div>
        </Card>
      </form>
    </>
  )
}
