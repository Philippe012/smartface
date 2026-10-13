import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarCheck, CalendarDays, ClipboardList, Clock, Fingerprint, Plus, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams, useSearchParams } from 'react-router'
import { z } from 'zod'

import { ScanBanner } from '../../components/ScanBanner'
import { Badge } from '../../components/ui/Badge'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Card, CardBody, CardHeader, DetailList, StatCard } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Dialog } from '../../components/ui/Dialog'
import { Alert, EmptyState, ErrorState, LoadingBlock } from '../../components/ui/Feedback'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { Pagination, Table, TBody, Td, Th, THead, Tr } from '../../components/ui/Table'
import { useToast } from '../../components/ui/Toast'
import { useApi } from '../../hooks/useApi'
import { api, withQuery } from '../../lib/api'
import { formatDate, formatDateTime, formatTime, fromDateTimeLocal, toDateTimeLocal } from '../../lib/format'
import { applyServerErrors } from '../../lib/forms'
import type { AttendanceEvent, CorrectionKind, CorrectionRequest, MySummary, Paginated } from '../../types/api'
import { useAuth } from '../auth/AuthContext'
import { AppearanceCard, PasswordChangeCard, ProfileForm, SessionsCard } from '../shared/AccountForms'
import { CorrectionStatusBadge, correctionKindLabel, EventStatusBadge, MatchBadge } from '../shared/StatusBadges'

// --- Correction request dialog -------------------------------------------------

const requestSchema = z
  .object({
    kind: z.enum(['missing', 'wrong_time', 'not_me', 'other']),
    requested_time: z.string(),
    reason: z.string().trim().min(5, 'Briefly explain what needs correcting.').max(1000),
  })
  .superRefine((v, ctx) => {
    if ((v.kind === 'missing' || v.kind === 'wrong_time') && !v.requested_time)
      ctx.addIssue({ code: 'custom', path: ['requested_time'], message: 'Enter the correct time.' })
  })
type RequestValues = z.infer<typeof requestSchema>

export function CorrectionRequestDialog({
  open,
  onClose,
  event,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  event?: AttendanceEvent
  onCreated: () => void
}) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    watch,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    values: {
      kind: event ? 'wrong_time' : 'missing',
      requested_time: event ? toDateTimeLocal(event.occurred_at) : '',
      reason: '',
    },
  })
  const kind = watch('kind')

  const submit = async (v: RequestValues) => {
    setFormError(null)
    try {
      await api('/me/correction-requests', {
        method: 'POST',
        body: {
          kind: v.kind,
          reason: v.reason,
          event_id: v.kind === 'missing' ? null : event?.id,
          requested_time: v.requested_time && (v.kind === 'missing' || v.kind === 'wrong_time') ? fromDateTimeLocal(v.requested_time) : null,
        },
      })
      reset()
      onCreated()
      onClose()
    } catch (err) {
      setFormError(applyServerErrors(err, setError, ['kind', 'requested_time', 'reason']))
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Request a correction"
      description={event ? `For your record on ${formatDateTime(event.occurred_at)}` : 'An administrator will review your request.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="correction-request" loading={isSubmitting}>
            Submit request
          </Button>
        </>
      }
    >
      <form id="correction-request" onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Field label="What is wrong?" error={errors.kind?.message}>
          {(p) => (
            <Select {...p} {...register('kind')}>
              {event ? (
                <>
                  <option value="wrong_time">The time is wrong</option>
                  <option value="not_me">This record is not mine</option>
                  <option value="other">Something else</option>
                </>
              ) : (
                <option value="missing">My attendance is missing</option>
              )}
            </Select>
          )}
        </Field>
        {(kind === 'missing' || kind === 'wrong_time') && (
          <Field label={kind === 'missing' ? 'When did you arrive?' : 'Correct time'} required error={errors.requested_time?.message}>
            {(p) => <Input {...p} type="datetime-local" {...register('requested_time')} />}
          </Field>
        )}
        <Field label="Reason" required error={errors.reason?.message}>
          {(p) => <Textarea {...p} {...register('reason')} placeholder="e.g. I arrived at 07:50 but the camera did not record me." />}
        </Field>
      </form>
    </Dialog>
  )
}

// --- Pages -----------------------------------------------------------------------

export function EmployeeDashboardPage() {
  const { data, error, reload } = useApi<MySummary>('/me/summary', { refreshMs: 60_000 })
  const [requesting, setRequesting] = useState(false)
  const toast = useToast()

  if (!data) {
    return (
      <>
        <PageHeader title="Overview" />
        <Card>{error ? <ErrorState error={error} onRetry={reload} /> : <LoadingBlock />}</Card>
      </>
    )
  }

  return (
    <>
      <ScanBanner
        title={`Hello, ${data.employee.full_name.split(' ')[0]}`}
        documentTitle="Overview"
        subtitle={formatDate(data.date)}
        live={!!data.today}
        status={data.today ? `Recorded IN at ${formatTime(data.today.occurred_at)}` : 'No arrival recorded yet today'}
        actions={
          <Button variant="secondary" icon={Plus} onClick={() => setRequesting(true)}>
            Report missing attendance
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Today"
          value={data.today ? formatTime(data.today.occurred_at) : 'Not recorded'}
          icon={data.today ? CalendarCheck : Clock}
          tone={data.today ? 'brand' : 'neutral'}
          hint={data.today ? `IN · ${data.today.camera?.name ?? 'manual entry'}` : 'Your arrival will appear here once recorded.'}
        />
        <StatCard label="Days recorded this month" value={data.month_days_present} icon={CalendarDays} />
        <StatCard
          label="Open correction requests"
          value={data.pending_corrections}
          icon={ClipboardList}
          tone={data.pending_corrections ? 'warning' : 'neutral'}
          hint={<Link to="/employee/correction-requests" className="font-medium text-brand-700">View requests</Link>}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent attendance"
            actions={<Link to="/employee/attendance" className="text-sm font-medium text-brand-700">View all</Link>}
          />
          {data.recent.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No attendance recorded yet" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recent.map((e) => (
                <li key={e.id}>
                  <Link to={`/employee/attendance/${e.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{formatDate(e.local_date)}</p>
                      <p className="text-xs text-slate-500">
                        {e.direction} at {formatTime(e.occurred_at)} · {e.camera?.name ?? 'Manual entry'}
                      </p>
                    </div>
                    <MatchBadge status={e.match_status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Your face enrollment" />
          <CardBody className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <Fingerprint size={20} className={data.enrollment.enrolled ? 'text-brand-700' : 'text-slate-400'} aria-hidden />
              <span className="font-medium text-slate-900">
                {data.enrollment.enrolled ? `Enrolled on ${formatDate(data.enrollment.enrolled_at)}` : 'Not enrolled'}
              </span>
            </div>
            <p className="text-slate-600">
              {data.enrollment.enrolled
                ? 'An encrypted template, not a photo, is stored on the local server and used only for attendance.'
                : 'Your attendance is recorded manually until you are enrolled.'}
            </p>
            <p className="text-slate-600">
              <span className="font-medium text-slate-800">Prefer not to use face recognition? </span>
              {data.alternative_method}
            </p>
            <Link to="/employee/profile" className="inline-flex items-center gap-1.5 font-medium text-brand-700">
              <ShieldCheck size={15} aria-hidden />
              Read the privacy notice
            </Link>
          </CardBody>
        </Card>
      </div>

      <CorrectionRequestDialog
        open={requesting}
        onClose={() => setRequesting(false)}
        onCreated={() => {
          toast.success('Request submitted. An administrator will review it.')
          reload()
        }}
      />
    </>
  )
}

const PAGE_SIZE = 20

export function MyAttendancePage() {
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page') ?? 1)
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const { data, error, reload } = useApi<Paginated<AttendanceEvent>>(withQuery('/me/attendance', { from, to, page, page_size: PAGE_SIZE }))
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    if (k !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  return (
    <>
      <PageHeader title="My attendance" description="Your own records. Contact an administrator or request a correction if something is wrong." />
      <Card>
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-[repeat(2,minmax(0,12rem))] sm:px-5">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">From</span>
            <Input type="date" value={from} onChange={(e) => set('from', e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">To</span>
            <Input type="date" value={to} onChange={(e) => set('to', e.target.value)} />
          </label>
        </div>
        {!data ? (
          error ? <ErrorState error={error} onRetry={reload} /> : <LoadingBlock />
        ) : data.results.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No records found" description={from || to ? 'Try a different date range.' : undefined} />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <Th>Date</Th>
                  <Th>Time</Th>
                  <Th className="hidden sm:table-cell">Recorded by</Th>
                  <Th>Status</Th>
                </tr>
              </THead>
              <TBody>
                {data.results.map((e) => (
                  <Tr key={e.id}>
                    <Td>
                      <Link to={`/employee/attendance/${e.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {formatDate(e.local_date)}
                      </Link>
                    </Td>
                    <Td className="tabular">
                      {e.direction} {formatTime(e.occurred_at)}
                    </Td>
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
            <Pagination page={page} pageSize={PAGE_SIZE} count={data.count} onPage={(p) => set('page', String(p))} />
          </>
        )}
      </Card>
    </>
  )
}

export function MyAttendanceDetailPage() {
  const { id } = useParams()
  const toast = useToast()
  const { data, error, reload } = useApi<AttendanceEvent & { corrections: CorrectionRequest[] }>(`/me/attendance/${id}`)
  const [requesting, setRequesting] = useState(false)
  const back = { to: '/employee/attendance', label: 'My attendance' }

  if (!data) {
    return (
      <>
        <PageHeader title="Attendance record" back={back} />
        <Card>{error ? <ErrorState error={error} onRetry={reload} /> : <LoadingBlock />}</Card>
      </>
    )
  }
  const hasPending = data.corrections.some((c) => c.status === 'pending')

  return (
    <>
      <PageHeader
        title={formatDate(data.local_date)}
        documentTitle="Attendance record"
        back={back}
        actions={
          data.status === 'confirmed' && (
            <Button variant="secondary" onClick={() => setRequesting(true)} disabled={hasPending}>
              {hasPending ? 'Correction pending' : 'Request correction'}
            </Button>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Record" />
          <CardBody className="py-2">
            <DetailList
              items={[
                { label: 'Time', value: formatDateTime(data.occurred_at) },
                { label: 'Direction', value: data.direction },
                { label: 'Status', value: <EventStatusBadge status={data.status} /> },
                { label: 'Recorded by', value: <MatchBadge status={data.match_status} /> },
                { label: 'Camera', value: data.camera?.name ?? 'Manual entry' },
                ...(data.notes ? [{ label: 'Notes', value: data.notes }] : []),
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Correction requests" />
          {data.corrections.length === 0 ? (
            <EmptyState title="None" className="py-8" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.corrections.map((c) => (
                <li key={c.id} className="px-4 py-3 text-sm sm:px-5">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium text-slate-900">{correctionKindLabel[c.kind]}</span>
                    <CorrectionStatusBadge status={c.status} />
                  </div>
                  <p className="mt-1 text-slate-600">{c.reason}</p>
                  {c.decision_note && <p className="mt-1 text-xs text-slate-500">Administrator: {c.decision_note}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <CorrectionRequestDialog
        open={requesting}
        event={data}
        onClose={() => setRequesting(false)}
        onCreated={() => {
          toast.success('Request submitted.')
          reload()
        }}
      />
    </>
  )
}

export function CorrectionRequestsPage() {
  const toast = useToast()
  const [page, setPage] = useState(1)
  const { data, error, reload } = useApi<Paginated<CorrectionRequest>>(withQuery('/me/correction-requests', { page, page_size: PAGE_SIZE }))
  const [requesting, setRequesting] = useState(false)
  const [cancelling, setCancelling] = useState<CorrectionRequest | null>(null)

  return (
    <>
      <PageHeader
        title="Correction requests"
        description="Ask an administrator to fix missing or incorrect attendance. Decisions and notes appear here."
        actions={
          <Button icon={Plus} onClick={() => setRequesting(true)}>
            Report missing attendance
          </Button>
        }
      />
      <Alert tone="info" className="mb-4">
        To correct an existing record, open it from{' '}
        <Link to="/employee/attendance" className="font-medium underline">
          My attendance
        </Link>{' '}
        and choose “Request correction”.
      </Alert>
      <Card>
        {!data ? (
          error ? <ErrorState error={error} onRetry={reload} /> : <LoadingBlock />
        ) : data.results.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No correction requests" />
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {data.results.map((c) => (
                <li key={c.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">{correctionKindLabel[c.kind as CorrectionKind]}</span>
                      <CorrectionStatusBadge status={c.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{c.reason}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Submitted {formatDateTime(c.created_at)}
                      {c.requested_time && ` · requested time ${formatDateTime(c.requested_time)}`}
                      {c.event && (
                        <>
                          {' · '}
                          <Link className="font-medium text-brand-700" to={`/employee/attendance/${c.event.id}`}>
                            record of {formatDate(c.event.occurred_at)}
                          </Link>
                        </>
                      )}
                    </p>
                    {c.decision_note && (
                      <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <span className="font-medium">{c.decided_by}:</span> {c.decision_note}
                      </p>
                    )}
                  </div>
                  {c.status === 'pending' && (
                    <Button size="sm" variant="ghost" onClick={() => setCancelling(c)}>
                      Cancel request
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <Pagination page={page} pageSize={PAGE_SIZE} count={data.count} onPage={setPage} />
          </>
        )}
      </Card>
      <CorrectionRequestDialog
        open={requesting}
        onClose={() => setRequesting(false)}
        onCreated={() => {
          toast.success('Request submitted.')
          reload()
        }}
      />
      <ConfirmDialog
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        onConfirm={async () => {
          await api(`/me/correction-requests/${cancelling!.id}/cancel`, { method: 'POST' })
          toast.success('Request cancelled.')
          reload()
        }}
        title="Cancel this request?"
        confirmLabel="Cancel request"
      />
    </>
  )
}

export function ProfilePage() {
  const { user } = useAuth()
  const { data } = useApi<MySummary>('/me/summary')
  const emp = user?.employee
  return (
    <>
      <PageHeader title="Profile" description="Your employee record as held by SmartFace." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Employee record" description="Ask an administrator to correct any of these details." />
          <CardBody className="py-2">
            {emp && (
              <DetailList
                items={[
                  { label: 'Name', value: emp.full_name },
                  { label: 'Employee number', value: emp.employee_number },
                  { label: 'Department', value: emp.department || '—' },
                  { label: 'Position', value: emp.position || '—' },
                  { label: 'Status', value: emp.status === 'active' ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge> },
                  {
                    label: 'Face enrollment',
                    value: data ? (data.enrollment.enrolled ? `Enrolled on ${formatDate(data.enrollment.enrolled_at)}` : 'Not enrolled') : '—',
                  },
                ]}
              />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Privacy notice" />
          <CardBody className="space-y-3 text-sm text-slate-600">
            <p className="whitespace-pre-line">{data?.privacy_notice ?? 'Loading…'}</p>
            {data && (
              <p>
                <span className="font-medium text-slate-800">Alternative method: </span>
                {data.alternative_method}
              </p>
            )}
            <p>You can ask an administrator to delete your face template at any time.</p>
          </CardBody>
        </Card>
      </div>
      <div className="mt-6">
        <ButtonLink to="/employee/settings" variant="secondary">
          Update contact details
        </ButtonLink>
      </div>
    </>
  )
}

export function EmployeeSettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Appearance and contact details." />
      <div className="space-y-6">
        <AppearanceCard />
        <ProfileForm />
      </div>
    </>
  )
}

export function EmployeeSecurityPage() {
  return (
    <>
      <PageHeader title="Security" description="Your password and sign-in activity." />
      <div className="space-y-6">
        <PasswordChangeCard />
        <SessionsCard />
      </div>
    </>
  )
}
