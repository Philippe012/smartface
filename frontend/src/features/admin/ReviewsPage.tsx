import clsx from 'clsx'
import { ClipboardCheck, Inbox } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Dialog } from '../../components/ui/Dialog'
import { Alert, EmptyState, ErrorState, LoadingBlock } from '../../components/ui/Feedback'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { Pagination, Table, TBody, Td, Th, THead, Tr } from '../../components/ui/Table'
import { useToast } from '../../components/ui/Toast'
import { useApi } from '../../hooks/useApi'
import { api, errorMessage, withQuery } from '../../lib/api'
import { formatDate, formatDateTime, formatTime, fromDateTimeLocal, toDateTimeLocal } from '../../lib/format'
import type { AttendanceEvent, CorrectionRequest, Paginated } from '../../types/api'
import { useAuth } from '../auth/AuthContext'
import { ReviewDialog } from './attendance/ActionDialogs'
import { ConfidenceText, CorrectionStatusBadge, correctionKindLabel, MatchBadge } from '../shared/StatusBadges'

const PAGE_SIZE = 20

function ObservationQueue({ canAct }: { canAct: boolean }) {
  const toast = useToast()
  const [page, setPage] = useState(1)
  const { data, error, reload } = useApi<Paginated<AttendanceEvent>>(
    withQuery('/attendance', { status: 'pending_review', page, page_size: PAGE_SIZE }),
    { refreshMs: 30_000 },
  )
  const [selected, setSelected] = useState<AttendanceEvent | null>(null)

  if (!data) return error ? <ErrorState error={error} onRetry={reload} /> : <LoadingBlock />
  if (data.results.length === 0)
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="Nothing to review"
        description="Uncertain and unknown camera observations will appear here. They are never counted as attendance until confirmed."
      />
    )

  return (
    <>
      <Table>
        <THead>
          <tr>
            <Th>Observation</Th>
            <Th>When</Th>
            <Th className="hidden md:table-cell">Camera</Th>
            <Th className="hidden sm:table-cell">Score</Th>
            <Th className="text-right">
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </THead>
        <TBody>
          {data.results.map((e) => (
            <Tr key={e.id}>
              <Td>
                <Link to={`/admin/attendance/${e.id}`} className="group block">
                  <span className="block font-medium text-slate-900 group-hover:text-brand-700">
                    {e.candidate_employee ? `Possibly ${e.candidate_employee.full_name}` : 'Unknown face'}
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <MatchBadge status={e.match_status} />
                    {e.sighting_count > 1 && `seen ${e.sighting_count}×`}
                  </span>
                </Link>
              </Td>
              <Td className="tabular whitespace-nowrap">
                <span className="block">{formatTime(e.occurred_at)}</span>
                <span className="block text-xs text-slate-500">{formatDate(e.local_date)}</span>
              </Td>
              <Td className="hidden md:table-cell">{e.camera?.name ?? '—'}</Td>
              <Td className="hidden sm:table-cell">
                <ConfidenceText value={e.confidence} />
              </Td>
              <Td className="text-right">
                {canAct && (
                  <Button size="sm" variant="secondary" onClick={() => setSelected(e)}>
                    Review
                  </Button>
                )}
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
      <Pagination page={page} pageSize={PAGE_SIZE} count={data.count} onPage={setPage} />
      <ReviewDialog
        event={selected}
        onClose={() => setSelected(null)}
        onDone={(e) => {
          toast.success(e.status === 'confirmed' ? 'Attendance confirmed.' : 'Observation rejected.')
          reload()
        }}
      />
    </>
  )
}

function DecisionDialog({ request, onClose, onDone }: { request: CorrectionRequest | null; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastId, setLastId] = useState<number | null>(null)
  if (request && request.id !== lastId) {
    setLastId(request.id)
    setNote('')
    setError(null)
    setTime(toDateTimeLocal(request.requested_time))
  }
  const needsTime = request?.kind === 'missing' || request?.kind === 'wrong_time'

  const decide = async (approve: boolean) => {
    if (!request) return
    if (!approve && !note.trim()) return setError('Explain why the request is rejected. The employee will see this note.')
    setBusy(approve ? 'approve' : 'reject')
    setError(null)
    try {
      await api(`/correction-requests/${request.id}/decide`, {
        method: 'POST',
        body: { approve, note, occurred_at: approve && needsTime && time ? fromDateTimeLocal(time) : null },
      })
      onDone()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog
      open={request !== null}
      onClose={onClose}
      title="Decide correction request"
      description={request && `${request.employee.full_name} · ${correctionKindLabel[request.kind]}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy !== null}>
            Cancel
          </Button>
          <Button variant="danger-outline" onClick={() => decide(false)} loading={busy === 'reject'} disabled={busy === 'approve'}>
            Reject
          </Button>
          <Button onClick={() => decide(true)} loading={busy === 'approve'} disabled={busy === 'reject'}>
            Approve and apply
          </Button>
        </>
      }
    >
      {request && (
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="text-slate-500">Employee's reason</p>
            <p className="mt-1 text-slate-800">{request.reason}</p>
            {request.event && (
              <p className="mt-2 text-xs text-slate-500">
                Record:{' '}
                <Link className="font-medium text-brand-700" to={`/admin/attendance/${request.event.id}`}>
                  #{request.event.id} · {formatDateTime(request.event.occurred_at)}
                </Link>
              </p>
            )}
          </div>
          {request.kind === 'not_me' && <Alert tone="warning">Approving voids the referenced record.</Alert>}
          {needsTime && (
            <Field label={request.kind === 'missing' ? 'Arrival time to record' : 'Corrected time'} hint="Pre-filled with the employee's requested time.">
              {(p) => <Input {...p} type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} />}
            </Field>
          )}
          <Field label="Note to employee" hint="Required when rejecting.">
            {(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
        </div>
      )}
    </Dialog>
  )
}

function CorrectionQueue() {
  const toast = useToast()
  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const { data, error, reload } = useApi<Paginated<CorrectionRequest>>(
    withQuery('/correction-requests', { status, page, page_size: PAGE_SIZE }),
  )
  const [selected, setSelected] = useState<CorrectionRequest | null>(null)

  return (
    <>
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
        <label htmlFor="correction-status" className="text-sm text-slate-500">
          Show
        </label>
        <Select
          id="correction-status"
          className="w-auto"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
          <option value="">All</option>
        </Select>
      </div>
      {!data ? (
        error ? <ErrorState error={error} onRetry={reload} /> : <LoadingBlock />
      ) : data.results.length === 0 ? (
        <EmptyState icon={Inbox} title="No correction requests" description="Requests submitted by employees from their portal appear here." />
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <Th>Employee</Th>
                <Th>Request</Th>
                <Th className="hidden md:table-cell">Submitted</Th>
                <Th>Status</Th>
                <Th className="text-right">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              {data.results.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    <span className="block font-medium text-slate-900">{r.employee.full_name}</span>
                    <span className="tabular block text-xs text-slate-500">{r.employee.employee_number}</span>
                  </Td>
                  <Td>
                    <span className="block">{correctionKindLabel[r.kind]}</span>
                    <span className="block max-w-xs truncate text-xs text-slate-500" title={r.reason}>
                      {r.reason}
                    </span>
                  </Td>
                  <Td className="hidden md:table-cell">
                    <span className="block">{formatDateTime(r.created_at)}</span>
                    <span className="block text-xs text-slate-500">by {r.requested_by}</span>
                  </Td>
                  <Td>
                    <CorrectionStatusBadge status={r.status} />
                  </Td>
                  <Td className="text-right">
                    {r.status === 'pending' && (
                      <Button size="sm" variant="secondary" onClick={() => setSelected(r)}>
                        Decide
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} count={data.count} onPage={setPage} />
        </>
      )}
      <DecisionDialog
        request={selected}
        onClose={() => setSelected(null)}
        onDone={() => {
          toast.success('Decision saved.')
          reload()
        }}
      />
    </>
  )
}

export function ReviewsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [params, setParams] = useSearchParams()
  const tab = isAdmin && params.get('tab') === 'corrections' ? 'corrections' : 'observations'
  const { data: counts } = useApi<{ pending_reviews: number; pending_corrections: number }>('/attendance/review-counts', { refreshMs: 30_000 })

  const tabs = [
    { key: 'observations', label: 'Camera observations', count: counts?.pending_reviews },
    ...(isAdmin ? [{ key: 'corrections', label: 'Correction requests', count: counts?.pending_corrections }] : []),
  ]

  return (
    <>
      <PageHeader title="Reviews" description="Human decisions on uncertain recognition results and employee correction requests." />
      {!isAdmin && (
        <Alert tone="info" className="mb-4">
          You can view the review queue. Only administrators can confirm or reject items.
        </Alert>
      )}
      <Card>
        <div role="tablist" aria-label="Review queues" className="flex gap-1 overflow-x-auto border-b border-slate-200 px-2 sm:px-3">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={tab === t.key}
              onClick={() => setParams(t.key === 'observations' ? {} : { tab: t.key }, { replace: true })}
              className={clsx(
                '-mb-px flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap',
                tab === t.key ? 'border-brand-700 text-brand-800' : 'border-transparent text-slate-500 hover:text-slate-800',
              )}
            >
              {t.label}
              {!!t.count && (
                <span className="tabular rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800">{t.count}</span>
              )}
            </button>
          ))}
        </div>
        <div role="tabpanel">{tab === 'observations' ? <ObservationQueue canAct={isAdmin} /> : <CorrectionQueue />}</div>
      </Card>
    </>
  )
}
