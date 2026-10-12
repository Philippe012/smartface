import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarDays, Fingerprint, KeyRound, Pencil, Power, ScanFace, Trash2, UserX } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { z } from 'zod'

import { Badge } from '../../../components/ui/Badge'
import { Button, ButtonLink } from '../../../components/ui/Button'
import { Card, CardBody, CardHeader, DetailList } from '../../../components/ui/Card'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { Dialog } from '../../../components/ui/Dialog'
import { Alert, EmptyState, ErrorState, LoadingBlock } from '../../../components/ui/Feedback'
import { Field, Input, PasswordInput } from '../../../components/ui/Field'
import { PageHeader } from '../../../components/ui/PageHeader'
import { Table, TBody, Td, Th, THead, Tr } from '../../../components/ui/Table'
import { useToast } from '../../../components/ui/Toast'
import { useApi } from '../../../hooks/useApi'
import { api } from '../../../lib/api'
import { formatDate, formatDateTime, formatTime } from '../../../lib/format'
import { applyServerErrors } from '../../../lib/forms'
import type { AttendanceEvent, Employee, EnrollmentSession, Paginated } from '../../../types/api'
import { useAuth } from '../../auth/AuthContext'
import { EmployeeStatusBadge, EventStatusBadge, MatchBadge } from '../../shared/StatusBadges'

const accountSchema = z.object({
  username: z.string().trim().min(3, 'Use at least 3 characters.').max(150),
  email: z.union([z.literal(''), z.email('Enter a valid email address.')]),
  password: z.string().min(10, 'Use at least 10 characters.'),
})
type AccountValues = z.infer<typeof accountSchema>

function CreateAccountDialog({ employee, open, onClose, onCreated }: { employee: Employee; open: boolean; onClose: () => void; onCreated: (e: Employee) => void }) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    values: { username: employee.employee_number.toLowerCase(), email: employee.email, password: '' },
  })
  const submit = async (values: AccountValues) => {
    setFormError(null)
    try {
      onCreated(await api<Employee>(`/employees/${employee.id}/account`, { method: 'POST', body: values }))
      reset()
    } catch (err) {
      setFormError(applyServerErrors(err, setError, ['username', 'email', 'password']))
    }
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create portal account"
      description={`${employee.full_name} will be able to view their own attendance and request corrections.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-account" loading={isSubmitting}>
            Create account
          </Button>
        </>
      }
    >
      <form id="create-account" onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Field label="Username" required error={errors.username?.message}>
          {(p) => <Input {...p} {...register('username')} autoComplete="off" />}
        </Field>
        <Field label="Email" error={errors.email?.message} hint="Needed for self-service password recovery.">
          {(p) => <Input {...p} type="email" {...register('email')} autoComplete="off" />}
        </Field>
        <Field label="Temporary password" required error={errors.password?.message} hint="Share it securely and ask the employee to change it after signing in.">
          {(p) => <PasswordInput {...p} {...register('password')} autoComplete="new-password" />}
        </Field>
      </form>
    </Dialog>
  )
}

export function EmployeeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { data: employee, error, reload, setData } = useApi<Employee>(`/employees/${id}`)
  const { data: events } = useApi<Paginated<AttendanceEvent>>(`/attendance?employee=${id}&page_size=8`)
  const { data: sessions, reload: reloadSessions } = useApi<EnrollmentSession[]>(isAdmin ? `/employees/${id}/enrollments` : null)
  const [dialog, setDialog] = useState<null | 'status' | 'erase' | 'delete' | 'account' | 'remove-account'>(null)

  if (!employee) {
    return (
      <>
        <PageHeader title="Employee" back={{ to: '/admin/employees', label: 'Employees' }} />
        <Card>{error ? <ErrorState error={error} onRetry={reload} /> : <LoadingBlock />}</Card>
      </>
    )
  }

  const active = employee.status === 'active'
  const { enrollment } = employee

  const changeStatus = async (reason: string) => {
    const updated = await api<Employee>(`/employees/${employee.id}/${active ? 'deactivate' : 'activate'}`, {
      method: 'POST',
      body: { reason },
    })
    setData(updated)
    toast.success(active ? 'Employee deactivated. They will no longer be recognised.' : 'Employee reactivated.')
  }

  const erase = async (reason: string) => {
    const res = await api<{ templates_deleted: number }>(`/employees/${employee.id}/biometrics/erase`, {
      method: 'POST',
      body: { reason },
    })
    toast.success(`Enrollment revoked. ${res.templates_deleted} face templates permanently deleted.`)
    reload()
    reloadSessions()
  }

  const remove = async () => {
    await api(`/employees/${employee.id}`, { method: 'DELETE' })
    toast.success('Employee deleted.')
    navigate('/admin/employees', { replace: true })
  }

  const removeAccount = async () => {
    await api(`/employees/${employee.id}/account`, { method: 'DELETE' })
    toast.success('Portal account removed.')
    reload()
  }

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {employee.full_name}
            <EmployeeStatusBadge status={employee.status} />
          </span>
        }
        documentTitle={employee.full_name}
        description={`${employee.employee_number}${employee.position ? ` · ${employee.position}` : ''}${employee.department ? ` · ${employee.department}` : ''}`}
        back={{ to: '/admin/employees', label: 'Employees' }}
        actions={
          isAdmin && (
            <>
              <ButtonLink to={`/admin/employees/${employee.id}/edit`} variant="secondary" icon={Pencil}>
                Edit
              </ButtonLink>
              <Button variant={active ? 'danger-outline' : 'secondary'} icon={Power} onClick={() => setDialog('status')}>
                {active ? 'Deactivate' : 'Reactivate'}
              </Button>
            </>
          )
        }
      />

      {!active && (
        <Alert tone="warning" className="mb-6" title="This employee is inactive">
          Inactive employees are excluded from face matching and cannot sign in to the portal.
          {employee.deactivated_at && ` Deactivated on ${formatDate(employee.deactivated_at)}.`}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="py-2">
              <DetailList
                items={[
                  { label: 'Employee number', value: <span className="tabular">{employee.employee_number}</span> },
                  { label: 'Email', value: employee.email || '—' },
                  { label: 'Phone', value: employee.phone || '—' },
                  { label: 'Department', value: employee.department || '—' },
                  { label: 'Position', value: employee.position || '—' },
                  { label: 'Created', value: formatDateTime(employee.created_at) },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Recent attendance"
              actions={
                <Link to={`/admin/attendance?employee=${employee.id}`} className="text-sm font-medium text-brand-700 hover:text-brand-800">
                  Full history
                </Link>
              }
            />
            {!events ? (
              <LoadingBlock />
            ) : events.results.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No attendance records yet" />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Time</Th>
                    <Th className="hidden sm:table-cell">Source</Th>
                    <Th>Status</Th>
                  </tr>
                </THead>
                <TBody>
                  {events.results.map((e) => (
                    <Tr key={e.id}>
                      <Td>
                        <Link to={`/admin/attendance/${e.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                          {formatDate(e.local_date)}
                        </Link>
                      </Td>
                      <Td className="tabular">{formatTime(e.occurred_at)}</Td>
                      <Td className="hidden sm:table-cell">
                        <MatchBadge status={e.match_status} />
                      </Td>
                      <Td>
                        <EventStatusBadge status={e.status} />
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Face enrollment" />
            <CardBody className="space-y-4">
              <div className="flex items-center gap-3">
                <span className={`flex size-10 items-center justify-center rounded-md ${enrollment.enrolled ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>
                  <Fingerprint size={20} aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {enrollment.enrolled ? 'Enrolled' : enrollment.has_session_in_progress ? 'Enrollment in progress' : 'Not enrolled'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {enrollment.enrolled
                      ? `${enrollment.template_count} templates · ${formatDate(enrollment.enrolled_at)}`
                      : 'No face templates stored'}
                  </p>
                </div>
              </div>
              {isAdmin && (
                <div className="flex flex-col gap-2">
                  {active && (
                    <ButtonLink to={`/admin/employees/${employee.id}/enrollment`} icon={ScanFace} variant={enrollment.enrolled ? 'secondary' : 'primary'}>
                      {enrollment.enrolled ? 'Re-enroll' : enrollment.has_session_in_progress ? 'Continue enrollment' : 'Start enrollment'}
                    </ButtonLink>
                  )}
                  {(enrollment.enrolled || enrollment.has_session_in_progress) && (
                    <Button variant="danger-outline" icon={Trash2} onClick={() => setDialog('erase')}>
                      Revoke and delete templates
                    </Button>
                  )}
                </div>
              )}
              {sessions && sessions.length > 0 && (
                <div className="border-t border-slate-100 pt-3">
                  <p className="mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase">History</p>
                  <ul className="space-y-1.5 text-xs text-slate-600">
                    {sessions.slice(0, 5).map((s) => (
                      <li key={s.id} className="flex justify-between gap-2">
                        <span>{formatDate(s.created_at)} · {s.started_by ?? 'unknown'}</span>
                        <Badge tone={s.status === 'completed' ? 'success' : s.status === 'in_progress' ? 'warning' : 'neutral'}>
                          {s.status.replace('_', ' ')}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Portal account" />
            <CardBody className="space-y-4">
              {employee.account ? (
                <>
                  <DetailList
                    items={[
                      { label: 'Username', value: employee.account.username },
                      { label: 'Last sign-in', value: formatDateTime(employee.account.last_login, 'Never') },
                      { label: 'Status', value: employee.account.is_active ? 'Enabled' : 'Disabled' },
                    ]}
                  />
                  {isAdmin && (
                    <Button variant="danger-outline" icon={UserX} className="w-full" onClick={() => setDialog('remove-account')}>
                      Remove portal account
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-500">This employee cannot sign in yet.</p>
                  {isAdmin && active && (
                    <Button variant="secondary" icon={KeyRound} className="w-full" onClick={() => setDialog('account')}>
                      Create portal account
                    </Button>
                  )}
                </>
              )}
            </CardBody>
          </Card>

          {isAdmin && (
            <Card>
              <CardHeader title="Delete employee" />
              <CardBody className="space-y-3">
                <p className="text-sm text-slate-500">
                  Only possible when there is no attendance history. Otherwise deactivate the employee; records are
                  kept according to the retention policy.
                </p>
                <Button variant="danger-outline" icon={Trash2} className="w-full" onClick={() => setDialog('delete')}>
                  Delete employee
                </Button>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={dialog === 'status'}
        onClose={() => setDialog(null)}
        onConfirm={changeStatus}
        title={active ? `Deactivate ${employee.full_name}?` : `Reactivate ${employee.full_name}?`}
        description={
          active
            ? 'They will immediately stop being recognised and their portal login will be disabled. Biometric templates are deleted automatically after the retention period.'
            : 'They will be matched by the camera again (if enrolled) and can sign in to the portal.'
        }
        confirmLabel={active ? 'Deactivate' : 'Reactivate'}
        danger={active}
        requireReason={active}
      />
      <ConfirmDialog
        open={dialog === 'erase'}
        onClose={() => setDialog(null)}
        onConfirm={erase}
        title="Revoke enrollment and delete templates?"
        description="All face templates for this employee are permanently deleted. Automatic recognition stops until they are enrolled again."
        confirmLabel="Delete templates"
        danger
        requireReason
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        onConfirm={remove}
        title={`Delete ${employee.full_name}?`}
        description="The employee record, face templates and portal account are permanently deleted. This cannot be undone."
        confirmLabel="Delete employee"
        danger
      />
      <ConfirmDialog
        open={dialog === 'remove-account'}
        onClose={() => setDialog(null)}
        onConfirm={removeAccount}
        title="Remove portal account?"
        description="The employee will no longer be able to sign in. Their attendance records are not affected."
        confirmLabel="Remove account"
        danger
      />
      <CreateAccountDialog
        employee={employee}
        open={dialog === 'account'}
        onClose={() => setDialog(null)}
        onCreated={(updated) => {
          setData(updated)
          setDialog(null)
          toast.success('Portal account created.')
        }}
      />
    </>
  )
}
