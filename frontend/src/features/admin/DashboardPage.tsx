import {
  ArrowRight,
  Camera,
  ClipboardCheck,
  Cpu,
  Database,
  Fingerprint,
  RefreshCw,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Badge } from '../../components/ui/Badge'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Card, CardBody, CardHeader, StatCard } from '../../components/ui/Card'
import { Alert, EmptyState, ErrorState, LoadingBlock } from '../../components/ui/Feedback'
import { PageHeader } from '../../components/ui/PageHeader'
import { useApi } from '../../hooks/useApi'
import { formatDate, formatRelative, formatTime } from '../../lib/format'
import type { DashboardSummary } from '../../types/api'
import { useAuth } from '../auth/AuthContext'
import { DailyBarChart } from '../shared/DailyBarChart'
import { CameraHealthBadge, EventStatusBadge, MatchBadge, WorkerBadge } from '../shared/StatusBadges'

function ServiceRow({ icon: Icon, label, status, detail }: { icon: typeof Database; label: string; status: ReactNode; detail?: ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <Icon size={17} className="mt-0.5 shrink-0 text-slate-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-800">{label}</p>
          {status}
        </div>
        {detail && <p className="mt-0.5 text-xs text-slate-500">{detail}</p>}
      </div>
    </li>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const { data, error, loading, reload } = useApi<DashboardSummary>('/dashboard', { refreshMs: 30_000 })

  if (!data) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Card>{loading ? <LoadingBlock /> : <ErrorState error={error} onRetry={reload} />}</Card>
      </>
    )
  }

  const { services } = data
  const setupIssues: { title: string; text: ReactNode }[] = []
  if (!services.recognition.encryption_configured)
    setupIssues.push({ title: 'Encryption key missing', text: 'Set SMARTFACE_ENCRYPTION_KEY in backend/.env before enrolling employees or saving camera passwords.' })
  if (!services.recognition.models_installed)
    setupIssues.push({ title: 'Face models not installed', text: 'Run python scripts/download_models.py on the server.' })
  if (data.cameras.length === 0)
    setupIssues.push({ title: 'No camera configured', text: <Link className="font-medium underline" to="/admin/cameras/new">Add the entrance camera</Link> })
  if (services.worker.state !== 'running')
    setupIssues.push({
      title: 'Recognition service is not running',
      text: 'Automatic attendance is paused. Start it on the server with: python manage.py run_recognition. Use manual entry in the meantime.',
    })

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${formatDate(data.date)} · ${data.policy.timezone}`}
        actions={
          <>
            <Button variant="secondary" size="sm" icon={RefreshCw} onClick={reload} loading={loading}>
              Refresh
            </Button>
            <ButtonLink to="/admin/attendance" size="sm" icon={ArrowRight}>
              Today's attendance
            </ButtonLink>
          </>
        }
      />

      {setupIssues.length > 0 && (
        <div className="mb-6 space-y-3">
          {setupIssues.map((issue) => (
            <Alert key={issue.title} tone="warning" title={issue.title}>
              {issue.text}
            </Alert>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Recorded IN today"
          value={data.today.present}
          icon={UserCheck}
          tone="brand"
          hint={`of ${data.employees.active} active employees`}
        />
        <StatCard label="No record yet today" value={data.today.not_recorded} icon={UserX} hint="Not an absence until your policy says so" />
        <StatCard
          label="Awaiting review"
          value={data.pending_reviews + (user?.role === 'admin' ? data.pending_corrections : 0)}
          icon={ClipboardCheck}
          tone={data.pending_reviews + data.pending_corrections ? 'warning' : 'neutral'}
          hint={
            <Link to="/admin/reviews" className="font-medium text-brand-700 hover:text-brand-800">
              {data.pending_reviews} observations · {data.pending_corrections} correction requests
            </Link>
          }
        />
        <StatCard
          label="Enrolled employees"
          value={data.employees.enrolled}
          icon={Fingerprint}
          hint={`${data.employees.active - data.employees.enrolled} active employees not enrolled`}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Arrivals over the last 14 days" description="Confirmed IN records per day" />
          <CardBody>
            <DailyBarChart data={data.trend} label="Confirmed IN records per day for the last 14 days" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="System status" description="Live from the local server" />
          <CardBody className="py-1">
            <ul className="divide-y divide-slate-100">
              <ServiceRow
                icon={Database}
                label="Database"
                status={<Badge tone={services.database.state === 'ok' ? 'success' : 'danger'} dot>{services.database.state === 'ok' ? 'Connected' : 'Error'}</Badge>}
              />
              <ServiceRow
                icon={Cpu}
                label="Recognition service"
                status={<WorkerBadge worker={services.worker} />}
                detail={
                  services.worker.last_seen_at
                    ? `Last heartbeat ${formatRelative(services.worker.last_seen_at)}`
                    : 'Has not reported since installation'
                }
              />
              {data.cameras.map((c) => (
                <ServiceRow
                  key={c.id}
                  icon={Camera}
                  label={c.name}
                  status={<CameraHealthBadge value={c.health} />}
                  detail={c.last_error || (c.last_frame_at ? `Last frame ${formatRelative(c.last_frame_at)}` : c.location)}
                />
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Recent activity"
          actions={
            <Link to="/admin/attendance" className="text-sm font-medium text-brand-700 hover:text-brand-800">
              View all
            </Link>
          }
        />
        {data.recent_events.length === 0 ? (
          <EmptyState icon={Users} title="No attendance activity yet" description="Records appear here as the camera recognises employees or administrators enter attendance." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.recent_events.map((e) => {
              const person = e.employee ?? e.candidate_employee
              return (
                <li key={e.id}>
                  <Link to={`/admin/attendance/${e.id}`} className="flex flex-col gap-2 px-4 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {e.employee ? e.employee.full_name : e.match_status === 'uncertain' ? `Possible match: ${person?.full_name ?? 'unknown'}` : 'Unknown face'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDate(e.occurred_at)} at {formatTime(e.occurred_at)} · {e.camera?.name ?? 'Manual entry'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <MatchBadge status={e.match_status} />
                      <EventStatusBadge status={e.status} />
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </>
  )
}
