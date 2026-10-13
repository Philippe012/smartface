import { ChevronRight, Database, Eraser, Play, Plus, Save, UserCog } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useForm, type FieldValues } from 'react-hook-form'
import { Link } from 'react-router'

import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card, CardBody, CardHeader, DetailList } from '../../../components/ui/Card'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { Dialog } from '../../../components/ui/Dialog'
import { Alert, EmptyState, ErrorState, LoadingBlock } from '../../../components/ui/Feedback'
import { Checkbox, Field, Input, PasswordInput, Select, Textarea } from '../../../components/ui/Field'
import { PageHeader } from '../../../components/ui/PageHeader'
import { Table, TBody, Td, Th, THead, Tr } from '../../../components/ui/Table'
import { useToast } from '../../../components/ui/Toast'
import { useApi } from '../../../hooks/useApi'
import { api, errorMessage } from '../../../lib/api'
import { formatBytes, formatDateTime, formatRelative, humanize, WEEKDAYS } from '../../../lib/format'
import { applyServerErrors } from '../../../lib/forms'
import type { BackupRecord, StaffUser, SystemSettings, SystemStatus } from '../../../types/api'
import { useAuth } from '../../auth/AuthContext'
import { AppearanceCard, PasswordChangeCard, ProfileForm, SessionsCard } from '../../shared/AccountForms'
import { WorkerBadge } from '../../shared/StatusBadges'
import { SETTINGS_SECTIONS } from './SettingsLayout'

export function SettingsIndexPage() {
  const { user } = useAuth()
  const sections = SETTINGS_SECTIONS.filter((s) => !s.adminOnly || user?.role === 'admin')
  return (
    <>
      <PageHeader title="Settings" description="Account, security and system configuration." />
      <Card>
        <ul className="divide-y divide-slate-100">
          {sections.map((s) => (
            <li key={s.to}>
              <Link to={`/admin/settings/${s.to}`} className="flex items-center gap-4 px-4 py-4 hover:bg-slate-50 sm:px-5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                  <s.icon size={18} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-900">{s.label}</span>
                  <span className="block text-sm text-slate-500">{s.description}</span>
                </span>
                <ChevronRight size={18} className="text-slate-400" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}

export function AccountSettingsPage() {
  return (
    <>
      <PageHeader title="Account" description="Your profile and appearance." />
      <div className="space-y-6">
        <AppearanceCard />
        <ProfileForm />
      </div>
    </>
  )
}

// --- Staff accounts (admin) ---------------------------------------------------

function NewStaffDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { username: '', email: '', first_name: '', last_name: '', role: 'operator', password: '' } })
  const submit = async (values: FieldValues) => {
    setFormError(null)
    try {
      await api('/staff-users', { method: 'POST', body: values })
      reset()
      onCreated()
      onClose()
    } catch (err) {
      setFormError(applyServerErrors(err, setError, ['username', 'email', 'first_name', 'last_name', 'role', 'password']))
    }
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add staff account"
      description="Operators can monitor cameras, attendance and system health. Administrators have full access."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="new-staff" loading={isSubmitting}>
            Create account
          </Button>
        </>
      }
    >
      <form id="new-staff" onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" error={errors.first_name?.message as string}>
            {(p) => <Input {...p} {...register('first_name')} />}
          </Field>
          <Field label="Last name" error={errors.last_name?.message as string}>
            {(p) => <Input {...p} {...register('last_name')} />}
          </Field>
          <Field label="Username" required error={errors.username?.message as string}>
            {(p) => <Input {...p} {...register('username', { required: 'Username is required.' })} autoComplete="off" />}
          </Field>
          <Field label="Email" error={errors.email?.message as string}>
            {(p) => <Input {...p} type="email" {...register('email')} autoComplete="off" />}
          </Field>
          <Field label="Role" required>
            {(p) => (
              <Select {...p} {...register('role')}>
                <option value="operator">Operator</option>
                <option value="admin">Administrator</option>
              </Select>
            )}
          </Field>
          <Field label="Initial password" required error={errors.password?.message as string}>
            {(p) => <PasswordInput {...p} {...register('password', { required: 'Set an initial password.' })} autoComplete="new-password" />}
          </Field>
        </div>
      </form>
    </Dialog>
  )
}

function StaffUsersCard() {
  const { user } = useAuth()
  const toast = useToast()
  const { data, error, reload } = useApi<StaffUser[]>('/staff-users')
  const [adding, setAdding] = useState(false)

  const update = async (u: StaffUser, body: Record<string, unknown>, message: string) => {
    try {
      await api(`/staff-users/${u.id}`, { method: 'PATCH', body })
      toast.success(message)
      reload()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Card>
      <CardHeader
        title="Staff accounts"
        description="Administrators and operators. Employee portal accounts are managed from each employee's page."
        actions={
          <Button size="sm" variant="secondary" icon={Plus} onClick={() => setAdding(true)}>
            Add staff account
          </Button>
        }
      />
      {!data ? (
        error ? <ErrorState error={error} onRetry={reload} /> : <LoadingBlock />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>User</Th>
              <Th>Role</Th>
              <Th className="hidden md:table-cell">Last sign-in</Th>
              <Th>Status</Th>
              <Th className="text-right">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </THead>
          <TBody>
            {data.map((u) => (
              <Tr key={u.id}>
                <Td>
                  <span className="block font-medium text-slate-900">{u.username}</span>
                  <span className="block text-xs text-slate-500">{u.email || '—'}</span>
                </Td>
                <Td>{u.role === 'admin' ? 'Administrator' : 'Operator'}</Td>
                <Td className="hidden md:table-cell">{formatDateTime(u.last_login, 'Never')}</Td>
                <Td>
                  {!u.is_active ? <Badge>Disabled</Badge> : u.is_locked ? <Badge tone="warning">Locked</Badge> : <Badge tone="success">Active</Badge>}
                </Td>
                <Td className="text-right whitespace-nowrap">
                  {u.id !== user?.id && (
                    <div className="flex justify-end gap-1">
                      {u.is_locked && (
                        <Button size="sm" variant="ghost" onClick={() => update(u, { unlock: true }, 'Account unlocked.')}>
                          Unlock
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => update(u, { is_active: !u.is_active }, u.is_active ? 'Account disabled.' : 'Account enabled.')}
                      >
                        {u.is_active ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  )}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
      <NewStaffDialog
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={() => {
          toast.success('Staff account created.')
          reload()
        }}
      />
    </Card>
  )
}

export function SecuritySettingsPage() {
  const { user } = useAuth()
  return (
    <>
      <PageHeader title="Security" description="Protect your account and manage who can access the console." />
      <div className="space-y-6">
        <PasswordChangeCard />
        <SessionsCard />
        {user?.role === 'admin' && <StaffUsersCard />}
      </div>
    </>
  )
}

// --- System settings forms ------------------------------------------------------

function useSettingsForm<K extends keyof SystemSettings>(fields: K[]) {
  const toast = useToast()
  const { data, error, reload, setData } = useApi<SystemSettings>('/settings')
  const form = useForm<Pick<SystemSettings, K>>()
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (data) form.reset(Object.fromEntries(fields.map((f) => [f, data[f]])) as Pick<SystemSettings, K>)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const save = form.handleSubmit(async (values) => {
    setFormError(null)
    try {
      const updated = await api<SystemSettings>('/settings', { method: 'PATCH', body: values })
      setData(updated)
      toast.success('Settings saved.')
    } catch (err) {
      setFormError(applyServerErrors(err, form.setError, fields as string[]))
    }
  })

  return { data, error, reload, form, save, formError }
}

function SettingsCard({
  title,
  description,
  children,
  onSubmit,
  saving,
  dirty,
  error,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
  onSubmit: () => void
  saving: boolean
  dirty: boolean
  error: string | null
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
        noValidate
      >
        <CardBody className="space-y-5">
          {error && <Alert tone="danger">{error}</Alert>}
          {children}
        </CardBody>
        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
          <Button type="submit" icon={Save} loading={saving} disabled={!dirty}>
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  )
}

const ATTENDANCE_FIELDS: (keyof SystemSettings)[] = [
  'organization_name', 'dedup_interval_seconds', 'schedule_configured', 'work_start_time', 'grace_minutes', 'workdays',
  'match_threshold', 'uncertain_threshold', 'match_margin', 'min_face_size_px', 'min_sharpness', 'min_detection_score',
  'frame_sample_interval_ms', 'record_unknown_faces', 'enrollment_min_samples',
]

export function AttendanceSettingsPage() {
  const { data, error, reload, form, save, formError } = useSettingsForm(ATTENDANCE_FIELDS)
  const { register, watch, setValue, formState } = form
  const e = formState.errors as Record<string, { message?: string } | undefined>
  const num = { valueAsNumber: true }
  const workdays = (watch('workdays') as number[] | undefined) ?? []
  const scheduled = watch('schedule_configured') as boolean | undefined

  if (!data) return <Card>{error ? <ErrorState error={error} onRetry={reload} /> : <LoadingBlock />}</Card>

  return (
    <>
      <PageHeader title="Attendance & recognition" description={`Workplace timezone: ${data.timezone} (set TIME_ZONE in the server configuration).`} />
      <SettingsCard title="Attendance policy" description="Only IN events are recorded in this release: one confirmed IN per employee per day." onSubmit={save} saving={formState.isSubmitting} dirty={formState.isDirty} error={formError}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Organisation name" error={e.organization_name?.message}>
            {(p) => <Input {...p} {...register('organization_name')} />}
          </Field>
          <Field label="Merge repeated review items within (seconds)" error={e.dedup_interval_seconds?.message} hint="Uncertain/unknown sightings at the same camera inside this window become one review item.">
            {(p) => <Input {...p} type="number" min={10} {...register('dedup_interval_seconds', num)} />}
          </Field>
        </div>
        <div className="rounded-md border border-slate-200 p-4">
          <Checkbox
            {...register('schedule_configured')}
            label="Calculate lateness and absence"
            description="Enable only after your organisation has approved the schedule, grace period and workdays below."
          />
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <Field label="Work start time" error={e.work_start_time?.message}>
              {(p) => <Input {...p} type="time" {...register('work_start_time', { setValueAs: (v: string) => v || null })} disabled={!scheduled} />}
            </Field>
            <Field label="Grace period (minutes)" error={e.grace_minutes?.message}>
              {(p) => <Input {...p} type="number" min={0} {...register('grace_minutes', num)} disabled={!scheduled} />}
            </Field>
          </div>
          <fieldset className="mt-4" disabled={!scheduled}>
            <legend className="mb-2 text-sm font-medium text-slate-700">Workdays</legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day, i) => {
                const on = workdays.includes(i)
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setValue('workdays', on ? workdays.filter((d) => d !== i) : [...workdays, i].sort(), { shouldDirty: true })
                    }
                    className={
                      on
                        ? 'h-9 w-12 rounded-md bg-primary text-sm font-medium text-primary-fg disabled:opacity-50'
                        : 'h-9 w-12 rounded-md border border-slate-300 bg-surface text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50'
                    }
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </fieldset>
        </div>

        <div className="border-t border-slate-200 pt-5">
          <h3 className="text-sm font-semibold text-slate-900">Recognition thresholds</h3>
          <Alert tone="warning" className="mt-3">
            Defaults are conservative starting points, not validated values. Measure false-accept and false-reject
            rates during your pilot before changing them. Lower thresholds increase the risk of recording the wrong
            person.
          </Alert>
          <div className="mt-4 grid gap-5 sm:grid-cols-3">
            <Field label="Match threshold" error={e.match_threshold?.message} hint="Similarity needed to record automatically.">
              {(p) => <Input {...p} type="number" step="0.01" min={0} max={1} {...register('match_threshold', num)} />}
            </Field>
            <Field label="Review threshold" error={e.uncertain_threshold?.message} hint="Below this, a face is treated as unknown.">
              {(p) => <Input {...p} type="number" step="0.01" min={0} max={1} {...register('uncertain_threshold', num)} />}
            </Field>
            <Field label="Ambiguity margin" error={e.match_margin?.message} hint="Required lead over the second-best employee.">
              {(p) => <Input {...p} type="number" step="0.01" min={0} max={1} {...register('match_margin', num)} />}
            </Field>
            <Field label="Minimum face size (px)" error={e.min_face_size_px?.message}>
              {(p) => <Input {...p} type="number" min={20} {...register('min_face_size_px', num)} />}
            </Field>
            <Field label="Minimum sharpness" error={e.min_sharpness?.message}>
              {(p) => <Input {...p} type="number" step="1" min={0} {...register('min_sharpness', num)} />}
            </Field>
            <Field label="Minimum detection score" error={e.min_detection_score?.message}>
              {(p) => <Input {...p} type="number" step="0.01" min={0} max={1} {...register('min_detection_score', num)} />}
            </Field>
            <Field label="Frame sampling interval (ms)" error={e.frame_sample_interval_ms?.message}>
              {(p) => <Input {...p} type="number" min={100} step={50} {...register('frame_sample_interval_ms', num)} />}
            </Field>
            <Field label="Samples required to enroll" error={e.enrollment_min_samples?.message} hint="3 to 7.">
              {(p) => <Input {...p} type="number" min={3} max={7} {...register('enrollment_min_samples', num)} />}
            </Field>
          </div>
          <Checkbox
            className="mt-5"
            {...register('record_unknown_faces')}
            label="Queue unknown faces for review"
            description="No images are stored; reviewers see the time, camera and score only."
          />
        </div>
      </SettingsCard>
    </>
  )
}

export function PrivacySettingsPage() {
  const { data, error, reload, form, save, formError } = useSettingsForm(['privacy_notice', 'privacy_notice_version', 'alternative_method'])
  const { register, formState } = form
  if (!data) return <Card>{error ? <ErrorState error={error} onRetry={reload} /> : <LoadingBlock />}</Card>
  return (
    <>
      <PageHeader title="Privacy" description="Shown to employees before enrollment and in their portal." />
      <div className="space-y-6">
        <SettingsCard title="Notice and alternative" onSubmit={save} saving={formState.isSubmitting} dirty={formState.isDirty} error={formError}>
          <Field label="Privacy notice" hint="Explain what is collected, why, how long it is kept, and employees' rights. Have it reviewed for your jurisdiction.">
            {(p) => <Textarea {...p} rows={7} {...register('privacy_notice')} />}
          </Field>
          <Field label="Notice version" hint="Increase when the notice changes. Each enrollment records the version shown." className="sm:max-w-xs">
            {(p) => <Input {...p} {...register('privacy_notice_version')} />}
          </Field>
          <Field label="Alternative attendance method" hint="The non-biometric option available to employees.">
            {(p) => <Textarea {...p} rows={3} {...register('alternative_method')} />}
          </Field>
        </SettingsCard>
        <Card>
          <CardHeader title="How SmartFace handles biometric data" />
          <CardBody>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
              <li>Camera frames and enrollment images are processed in memory and never written to disk.</li>
              <li>Face templates are encrypted with SMARTFACE_ENCRYPTION_KEY and are never returned by the API.</li>
              <li>Deactivating an employee stops matching immediately; templates are deleted after the retention period.</li>
              <li>Revoking an enrollment permanently deletes all templates for that employee.</li>
              <li>Enrollment, revocation, exports and corrections are recorded in the audit log.</li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  )
}

export function RetentionSettingsPage() {
  const toast = useToast()
  const { data, error, reload, form, save, formError } = useSettingsForm([
    'unresolved_event_retention_days', 'attendance_retention_days', 'audit_retention_days', 'inactive_template_retention_days',
  ])
  const { register, formState } = form
  const { data: preview, reload: reloadPreview } = useApi<{ would_delete: Record<string, number> }>('/settings/retention')
  const [confirming, setConfirming] = useState(false)
  const num = { valueAsNumber: true }
  if (!data) return <Card>{error ? <ErrorState error={error} onRetry={reload} /> : <LoadingBlock />}</Card>

  const pending = Object.values(preview?.would_delete ?? {}).reduce((a, b) => a + b, 0)

  return (
    <>
      <PageHeader title="Retention" description="Set retention to match your approved policy. 0 means keep until deleted manually." />
      <div className="space-y-6">
        <SettingsCard title="Retention periods (days)" onSubmit={async () => { await save(); reloadPreview() }} saving={formState.isSubmitting} dirty={formState.isDirty} error={formError}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Unresolved unknown observations" hint="Rejected or unreviewed items with no employee.">
              {(p) => <Input {...p} type="number" min={0} {...register('unresolved_event_retention_days', num)} />}
            </Field>
            <Field label="Templates after deactivation" hint="Face templates of inactive employees.">
              {(p) => <Input {...p} type="number" min={0} {...register('inactive_template_retention_days', num)} />}
            </Field>
            <Field label="Attendance records" hint="Check legal record-keeping requirements first.">
              {(p) => <Input {...p} type="number" min={0} {...register('attendance_retention_days', num)} />}
            </Field>
            <Field label="Audit log">
              {(p) => <Input {...p} type="number" min={0} {...register('audit_retention_days', num)} />}
            </Field>
          </div>
        </SettingsCard>
        <Card>
          <CardHeader title="Apply retention" description="Schedule `python manage.py apply_retention` daily on the server, or run it now." />
          <CardBody className="space-y-4">
            {preview && (
              <DetailList
                items={
                  Object.keys(preview.would_delete).length
                    ? Object.entries(preview.would_delete).map(([k, v]) => ({ label: humanize(k), value: `${v} would be deleted` }))
                    : [{ label: 'Status', value: 'No retention periods are set.' }]
                }
              />
            )}
            <Button variant="danger-outline" icon={Eraser} disabled={!pending} onClick={() => setConfirming(true)}>
              Delete expired data now
            </Button>
          </CardBody>
        </Card>
      </div>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          await api('/settings/retention', { method: 'POST' })
          toast.success('Expired data deleted.')
          reloadPreview()
        }}
        title="Delete expired data?"
        description={`${pending} records past their retention period will be permanently deleted. Backups taken earlier still contain them until those backups expire.`}
        confirmLabel="Delete permanently"
        danger
      />
    </>
  )
}

export function BackupSettingsPage() {
  const toast = useToast()
  const { data, error, reload } = useApi<{ backup_dir: string; records: BackupRecord[] }>('/settings/backups')
  const [running, setRunning] = useState(false)

  const run = async () => {
    setRunning(true)
    try {
      await api('/settings/backups', { method: 'POST' })
      toast.success('Backup completed.')
    } catch (err) {
      toast.error(`Backup failed: ${errorMessage(err)}`)
    } finally {
      setRunning(false)
      reload()
    }
  }

  return (
    <>
      <PageHeader title="Backup" description="PostgreSQL backups with pg_dump, stored on the server." />
      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Backups"
            description={data ? `Saved to ${data.backup_dir}` : undefined}
            actions={
              <Button icon={Play} loading={running} onClick={run}>
                Back up now
              </Button>
            }
          />
          {!data ? (
            error ? <ErrorState error={error} onRetry={reload} /> : <LoadingBlock />
          ) : data.records.length === 0 ? (
            <EmptyState icon={Database} title="No backups yet" description="Run a backup now and schedule `python manage.py backup_db` daily." />
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th>Started</Th>
                  <Th>Status</Th>
                  <Th className="hidden md:table-cell">File</Th>
                  <Th className="hidden sm:table-cell">Size</Th>
                </tr>
              </THead>
              <TBody>
                {data.records.map((r) => (
                  <Tr key={r.id}>
                    <Td>
                      <span className="block">{formatDateTime(r.started_at)}</span>
                      <span className="block text-xs text-slate-500">by {r.triggered_by}</span>
                    </Td>
                    <Td>
                      {r.status === 'success' ? <Badge tone="success">Success</Badge> : <Badge tone="danger">Failed</Badge>}
                      {r.status === 'failed' && <p className="mt-1 max-w-xs text-xs text-red-700">{r.message}</p>}
                    </Td>
                    <Td className="hidden font-mono text-xs md:table-cell">{r.file_name}</Td>
                    <Td className="tabular hidden sm:table-cell">{r.size_bytes ? formatBytes(r.size_bytes) : '—'}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
        <Card>
          <CardHeader title="Backup and restore guidance" />
          <CardBody className="space-y-3 text-sm text-slate-600">
            <p>Copy backups to separate, encrypted storage with restricted access. A backup on the same disk does not protect against disk failure.</p>
            <p>
              Back up <span className="font-medium text-slate-800">SMARTFACE_ENCRYPTION_KEY</span> separately and securely. Without it, face templates and camera
              passwords in a restored database cannot be decrypted.
            </p>
            <p>Restore into an empty database (see the README for the full procedure):</p>
            <pre className="overflow-x-auto rounded-md bg-ink-950 p-3 text-xs text-white/90">
              pg_restore --clean --if-exists --no-owner -h 127.0.0.1 -U postgres -d SmartFace backups/smartface-YYYYMMDD-HHMMSS.dump
            </pre>
            <p>Test a restore on a separate machine on a regular schedule.</p>
          </CardBody>
        </Card>
      </div>
    </>
  )
}

export function SystemSettingsPage() {
  const { data, error, reload } = useApi<SystemStatus>('/settings/system-status', { refreshMs: 15_000 })
  if (!data) {
    return (
      <>
        <PageHeader title="System" />
        <Card>{error ? <ErrorState error={error} onRetry={reload} /> : <LoadingBlock />}</Card>
      </>
    )
  }
  const stats = data.worker.details
  return (
    <>
      <PageHeader title="System" description="Live status of the local SmartFace services." />
      <div className="space-y-6">
        {data.debug && (
          <Alert tone="warning" title="Development mode">
            DJANGO_DEBUG is enabled. Use DJANGO_DEBUG=False with HTTPS for production.
          </Alert>
        )}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Services" />
            <CardBody className="py-2">
              <DetailList
                items={[
                  { label: 'Database', value: data.database.state === 'ok' ? <Badge tone="success" dot>Connected ({data.database.vendor})</Badge> : <Badge tone="danger" dot>Error</Badge> },
                  { label: 'Recognition service', value: <WorkerBadge worker={data.worker} /> },
                  { label: 'Last heartbeat', value: data.worker.last_seen_at ? formatRelative(data.worker.last_seen_at) : 'Never' },
                  { label: 'Cameras processed', value: stats.cameras?.length ?? 0 },
                  { label: 'Enrolled employees loaded', value: stats.enrolled_employees ?? '—' },
                  { label: 'Face models', value: data.recognition.models_installed ? <Badge tone="success">Installed</Badge> : <Badge tone="danger">Missing</Badge> },
                  { label: 'Template encryption', value: data.recognition.encryption_configured ? <Badge tone="success">Configured</Badge> : <Badge tone="danger">Not configured</Badge> },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Environment" />
            <CardBody className="py-2">
              <DetailList
                items={[
                  { label: 'Server time', value: formatDateTime(data.server_time) },
                  { label: 'Timezone', value: data.timezone },
                  { label: 'Recognition model', value: data.recognition.model_version },
                  ...Object.entries(data.versions).map(([k, v]) => ({ label: humanize(k), value: v })),
                  { label: 'Last successful backup', value: formatDateTime(data.last_successful_backup, 'Never') },
                ]}
              />
            </CardBody>
          </Card>
        </div>
        <Card>
          <CardHeader title="Starting the services" />
          <CardBody className="space-y-2 text-sm text-slate-600">
            <p className="flex items-center gap-2">
              <UserCog size={16} className="text-slate-400" aria-hidden />
              The API server and the recognition worker are separate processes. Both must run for automatic attendance.
            </p>
            <pre className="overflow-x-auto rounded-md bg-ink-950 p-3 text-xs text-white/90">
{`python manage.py run_recognition     # recognition worker
python manage.py runserver           # development API server`}
            </pre>
          </CardBody>
        </Card>
      </div>
    </>
  )
}
