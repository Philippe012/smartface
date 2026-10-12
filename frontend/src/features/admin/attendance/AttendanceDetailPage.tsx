import { ClipboardCheck, History, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'

import { Button } from '../../../components/ui/Button'
import { Card, CardBody, CardHeader, DetailList } from '../../../components/ui/Card'
import { Alert, EmptyState, ErrorState, LoadingBlock } from '../../../components/ui/Feedback'
import { PageHeader } from '../../../components/ui/PageHeader'
import { useToast } from '../../../components/ui/Toast'
import { useApi } from '../../../hooks/useApi'
import { formatDate, formatDateTime, humanize } from '../../../lib/format'
import { AuditChanges } from '../../shared/AuditChanges'
import type { AttendanceDetail } from '../../../types/api'
import { useAuth } from '../../auth/AuthContext'
import { ConfidenceText, CorrectionStatusBadge, correctionKindLabel, EventStatusBadge, MatchBadge } from '../../shared/StatusBadges'
import { CorrectionDialog, ReviewDialog } from './ActionDialogs'

export function AttendanceDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const toast = useToast()
  const { data: event, error, reload } = useApi<AttendanceDetail>(`/attendance/${id}`)
  const [reviewing, setReviewing] = useState(false)
  const [correcting, setCorrecting] = useState(false)
  const back = { to: '/admin/attendance', label: 'Attendance' }

  if (!event) {
    return (
      <>
        <PageHeader title="Attendance record" back={back} />
        <Card>{error ? <ErrorState error={error} onRetry={reload} /> : <LoadingBlock />}</Card>
      </>
    )
  }

  const who = event.employee?.full_name ?? (event.candidate_employee ? `Possible: ${event.candidate_employee.full_name}` : 'Unknown face')

  return (
    <>
      <PageHeader
        title={`${event.direction} record #${event.id}`}
        description={`${who} · ${formatDate(event.local_date)}`}
        back={back}
        actions={
          isAdmin &&
          (event.status === 'pending_review' ? (
            <Button icon={ClipboardCheck} onClick={() => setReviewing(true)}>
              Review
            </Button>
          ) : event.status === 'confirmed' ? (
            <Button variant="secondary" icon={Pencil} onClick={() => setCorrecting(true)}>
              Correct
            </Button>
          ) : null)
        }
      />

      {event.status === 'pending_review' && (
        <Alert tone="warning" className="mb-6" title="Not counted as attendance yet">
          This observation was below the confidence needed for automatic recording. A person must confirm or reject
          it.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Record" />
          <CardBody className="py-2">
            <DetailList
              items={[
                {
                  label: 'Employee',
                  value: event.employee ? (
                    <Link to={`/admin/employees/${event.employee.id}`} className="font-medium text-brand-700 hover:text-brand-800">
                      {event.employee.full_name} · {event.employee.employee_number}
                    </Link>
                  ) : (
                    'Not assigned'
                  ),
                },
                ...(event.candidate_employee && !event.employee
                  ? [{ label: 'Best candidate', value: `${event.candidate_employee.full_name} (${event.candidate_employee.employee_number})` }]
                  : []),
                { label: 'Time', value: formatDateTime(event.occurred_at) },
                { label: 'Direction', value: event.direction },
                { label: 'Status', value: <EventStatusBadge status={event.status} /> },
                { label: 'Source', value: <MatchBadge status={event.match_status} /> },
                { label: 'Camera', value: event.camera ? `${event.camera.name}${event.camera.location ? ` · ${event.camera.location}` : ''}` : 'None (manual)' },
                { label: 'Match score', value: <ConfidenceText value={event.confidence} /> },
                { label: 'Sightings', value: `${event.sighting_count}${event.last_sighting_at ? ` · last ${formatDateTime(event.last_sighting_at)}` : ''}` },
                ...(event.model_version ? [{ label: 'Model', value: event.model_version }] : []),
                ...(event.created_by ? [{ label: 'Entered by', value: event.created_by }] : []),
                ...(event.reviewed_by ? [{ label: 'Reviewed', value: `${event.reviewed_by} · ${formatDateTime(event.reviewed_at)}` }] : []),
                ...(event.notes ? [{ label: 'Notes', value: event.notes }] : []),
              ]}
            />
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Corrections" />
            {event.corrections.length === 0 ? (
              <EmptyState title="No corrections" className="py-8" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {event.corrections.map((c) => (
                  <li key={c.id} className="px-4 py-3 sm:px-5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">{correctionKindLabel[c.kind]}</p>
                      <CorrectionStatusBadge status={c.status} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {c.requested_by} · {formatDateTime(c.created_at)}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">{c.reason}</p>
                    <AuditChanges changes={{ before: c.before, after: c.after }} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Audit history" />
            {event.history.length === 0 ? (
              <EmptyState icon={History} title="No audited changes" description="Automatic records have no history until someone changes them." className="py-8" />
            ) : (
              <ol className="divide-y divide-slate-100">
                {event.history.map((h) => (
                  <li key={h.id} className="px-4 py-3 sm:px-5">
                    <p className="text-sm font-medium text-slate-900">{humanize(h.action.replace('attendance.', ''))}</p>
                    <p className="text-xs text-slate-500">
                      {h.actor_username} · {formatDateTime(h.occurred_at)}
                    </p>
                    {h.reason && <p className="mt-1 text-sm text-slate-700">“{h.reason}”</p>}
                    <AuditChanges changes={h.changes} />
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>

      <ReviewDialog
        event={reviewing ? event : null}
        onClose={() => setReviewing(false)}
        onDone={(e) => {
          toast.success(e.status === 'confirmed' ? 'Attendance confirmed.' : 'Observation rejected.')
          reload()
        }}
      />
      {event.status === 'confirmed' && (
        <CorrectionDialog
          event={event}
          open={correcting}
          onClose={() => setCorrecting(false)}
          onDone={() => {
            toast.success('Correction saved.')
            reload()
          }}
        />
      )}
    </>
  )
}
