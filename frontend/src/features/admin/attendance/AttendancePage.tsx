import { CalendarDays, Download, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { EmptyState, ErrorState, LoadingBlock } from '../../../components/ui/Feedback'
import { Input, SearchInput, Select } from '../../../components/ui/Field'
import { PageHeader } from '../../../components/ui/PageHeader'
import { Pagination, Table, TBody, Td, Th, THead, Tr } from '../../../components/ui/Table'
import { useToast } from '../../../components/ui/Toast'
import { useApi, useDebounced } from '../../../hooks/useApi'
import { downloadFile, errorMessage, withQuery } from '../../../lib/api'
import { formatDate, formatTime, isoDate } from '../../../lib/format'
import type { AttendanceEvent, Camera, Employee, Paginated } from '../../../types/api'
import { useAuth } from '../../auth/AuthContext'
import { ConfidenceText, EventStatusBadge, MatchBadge } from '../../shared/StatusBadges'
import { ManualEntryDialog } from './ManualEntryDialog'

const PAGE_SIZE = 25
const FILTER_KEYS = ['from', 'to', 'employee', 'camera', 'status', 'match_status', 'search'] as const

export function AttendancePage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const today = isoDate()

  // Default view: today.
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? ''])) as Record<(typeof FILTER_KEYS)[number], string>
  if (!params.has('from') && !params.has('to') && !params.has('employee')) {
    filters.from = today
    filters.to = today
  }
  const page = Number(params.get('page') ?? 1)
  const [search, setSearch] = useState(filters.search)
  const debounced = useDebounced(search)
  const [manualOpen, setManualOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const update = (changes: Partial<Record<string, string>>) => {
    const next = new URLSearchParams(params)
    if (!next.has('from') && !next.has('to') && !next.has('employee')) {
      next.set('from', filters.from)
      next.set('to', filters.to)
    }
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    if (!('page' in changes)) next.delete('page')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if (debounced !== filters.search) update({ search: debounced })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  const { data, error, loading, reload } = useApi<Paginated<AttendanceEvent>>(
    withQuery('/attendance', { ...filters, page, page_size: PAGE_SIZE }),
    { refreshMs: 30_000 },
  )
  const { data: cameras } = useApi<Paginated<Camera>>('/cameras')
  const { data: employee } = useApi<Employee>(filters.employee ? `/employees/${filters.employee}` : null)

  const exportCsv = async () => {
    setExporting(true)
    try {
      await downloadFile('/attendance/export', filters, 'attendance.csv')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  const isToday = filters.from === today && filters.to === today

  return (
    <>
      <PageHeader
        title="Attendance"
        description={
          employee
            ? `Records for ${employee.full_name} (${employee.employee_number})`
            : isToday
              ? `Today, ${formatDate(today)}`
              : 'Filter by date, employee, camera and status.'
        }
        actions={
          <>
            {isAdmin && (
              <Button variant="secondary" icon={Download} onClick={exportCsv} loading={exporting}>
                Export CSV
              </Button>
            )}
            {isAdmin && (
              <Button icon={Plus} onClick={() => setManualOpen(true)}>
                Manual entry
              </Button>
            )}
          </>
        }
      />

      <Card>
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-6">
          <label className="block lg:col-span-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">From</span>
            <Input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => update({ from: e.target.value })} />
          </label>
          <label className="block lg:col-span-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">To</span>
            <Input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => update({ to: e.target.value })} />
          </label>
          <label className="block lg:col-span-2">
            <span className="mb-1 block text-xs font-medium text-slate-500">Employee</span>
            {filters.employee ? (
              <div className="flex h-10 items-center justify-between rounded-md border border-slate-300 bg-slate-50 px-3 text-sm">
                <span className="truncate">{employee?.full_name ?? `Employee #${filters.employee}`}</span>
                <button type="button" className="text-xs font-medium text-brand-700" onClick={() => update({ employee: '' })}>
                  Clear
                </button>
              </div>
            ) : (
              <SearchInput placeholder="Name or number" value={search} onChange={(e) => setSearch(e.target.value)} />
            )}
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Status</span>
            <Select value={filters.status} onChange={(e) => update({ status: e.target.value })}>
              <option value="">All</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending_review">Needs review</option>
              <option value="rejected">Rejected</option>
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Camera</span>
            <Select value={filters.camera} onChange={(e) => update({ camera: e.target.value })}>
              <option value="">All cameras</option>
              {cameras?.results.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2.5 text-sm sm:px-5">
          <span className="text-slate-500">Source:</span>
          {[
            ['', 'All'],
            ['matched', 'Face match'],
            ['manual', 'Manual'],
            ['reviewed', 'Reviewed'],
            ['uncertain', 'Uncertain'],
            ['unknown', 'Unknown'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => update({ match_status: value! })}
              aria-pressed={filters.match_status === value}
              className={
                filters.match_status === value
                  ? 'rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-fg'
                  : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200'
              }
            >
              {label}
            </button>
          ))}
          {!isToday && (
            <button type="button" className="ml-auto text-xs font-medium text-brand-700" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              Reset to today
            </button>
          )}
        </div>

        {error && !data ? (
          <ErrorState error={error} onRetry={reload} />
        ) : !data ? (
          <LoadingBlock />
        ) : data.results.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No records for these filters"
            description={isToday ? 'Nobody has been recorded today yet.' : 'Try a wider date range or fewer filters.'}
          />
        ) : (
          <div className={loading ? 'opacity-60 transition-opacity' : undefined}>
            <Table>
              <THead>
                <tr>
                  <Th>Employee</Th>
                  <Th>Date & time</Th>
                  <Th className="hidden md:table-cell">Camera</Th>
                  <Th className="hidden sm:table-cell">Source</Th>
                  <Th className="hidden lg:table-cell">Score</Th>
                  <Th>Status</Th>
                </tr>
              </THead>
              <TBody>
                {data.results.map((e) => (
                  <Tr key={e.id}>
                    <Td>
                      <Link to={`/admin/attendance/${e.id}`} className="group block">
                        <span className="block font-medium text-slate-900 group-hover:text-brand-700">
                          {e.employee?.full_name ??
                            (e.candidate_employee ? `Possibly ${e.candidate_employee.full_name}` : 'Unknown face')}
                        </span>
                        <span className="tabular block text-xs text-slate-500">
                          {e.employee?.employee_number ?? `Observation #${e.id}`}
                          {e.sighting_count > 1 && ` · seen ${e.sighting_count}×`}
                        </span>
                      </Link>
                    </Td>
                    <Td className="tabular whitespace-nowrap">
                      <span className="block">{formatTime(e.occurred_at)}</span>
                      <span className="block text-xs text-slate-500">{formatDate(e.local_date)}</span>
                    </Td>
                    <Td className="hidden md:table-cell">{e.camera?.name ?? '—'}</Td>
                    <Td className="hidden sm:table-cell">
                      <MatchBadge status={e.match_status} />
                    </Td>
                    <Td className="hidden lg:table-cell">
                      <ConfidenceText value={e.confidence} />
                    </Td>
                    <Td>
                      <EventStatusBadge status={e.status} />
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
            <Pagination page={page} pageSize={PAGE_SIZE} count={data.count} onPage={(p) => update({ page: String(p) })} />
          </div>
        )}
      </Card>

      <ManualEntryDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onCreated={(e) => {
          toast.success(`IN recorded for ${e.employee?.full_name}.`)
          reload()
        }}
      />
    </>
  )
}
