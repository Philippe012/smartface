import clsx from 'clsx'
import { Download, FileBarChart } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { Button } from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Alert, EmptyState, ErrorState, LoadingBlock } from '../../components/ui/Feedback'
import { Input } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { Table, TBody, Td, Th, THead, Tr } from '../../components/ui/Table'
import { useToast } from '../../components/ui/Toast'
import { useApi } from '../../hooks/useApi'
import { downloadFile, errorMessage, withQuery } from '../../lib/api'
import { formatDate, formatTime, isoDate } from '../../lib/format'
import type { DailyReport, DayState, MonthlyReport, Policy } from '../../types/api'
import { useAuth } from '../auth/AuthContext'
import { DailyBarChart } from '../shared/DailyBarChart'
import { DayStateBadge } from '../shared/StatusBadges'

function PolicyNotice({ policy, isAdmin }: { policy: Policy; isAdmin: boolean }) {
  if (policy.configured) {
    return (
      <p className="text-xs text-slate-500">
        Lateness uses a start time of {policy.work_start_time} with a {policy.grace_minutes}-minute grace period ({policy.timezone}).
      </p>
    )
  }
  return (
    <Alert tone="info" title="Lateness and absence are not calculated">
      No approved work schedule is configured, so reports show only whether an IN record exists.{' '}
      {isAdmin && (
        <Link to="/admin/settings/attendance" className="font-medium underline">
          Configure the attendance policy
        </Link>
      )}
    </Alert>
  )
}

function useExport() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const run = async (path: string, query: Record<string, string>) => {
    setBusy(true)
    try {
      await downloadFile(path, query)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return { busy, run }
}

const summaryOrder: { key: DayState; label: string }[] = [
  { key: 'present', label: 'Present' },
  { key: 'on_time', label: 'On time' },
  { key: 'late', label: 'Late' },
  { key: 'absent', label: 'Absent' },
  { key: 'no_record', label: 'No record' },
]

function DailyTab({ isAdmin }: { isAdmin: boolean }) {
  const [params, setParams] = useSearchParams()
  const date = params.get('date') ?? isoDate()
  const { data, error, reload, loading } = useApi<DailyReport>(withQuery('/reports/daily', { date }))
  const exporter = useExport()

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Date</span>
          <Input type="date" value={date} max={isoDate()} onChange={(e) => setParams({ tab: 'daily', date: e.target.value }, { replace: true })} />
        </label>
        {isAdmin && (
          <Button variant="secondary" icon={Download} loading={exporter.busy} onClick={() => exporter.run('/reports/daily/export', { date })}>
            Export CSV
          </Button>
        )}
      </div>
      {!data ? (
        error ? <ErrorState error={error} onRetry={reload} /> : <LoadingBlock />
      ) : (
        <div className={loading ? 'opacity-60' : undefined}>
          <CardBody className="space-y-4">
            <PolicyNotice policy={data.policy} isAdmin={isAdmin} />
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {summaryOrder
                .filter((s) => (data.policy.configured ? s.key !== 'no_record' || data.counts.no_record > 0 : ['present', 'no_record'].includes(s.key)))
                .map((s) => (
                  <div key={s.key} className="rounded-md border border-slate-200 px-3 py-2.5">
                    <dt className="text-xs text-slate-500">{s.label}</dt>
                    <dd className="tabular mt-0.5 text-lg font-semibold text-slate-900">{data.counts[s.key]}</dd>
                  </div>
                ))}
            </dl>
            {data.policy.configured && !data.is_workday && <p className="text-sm text-slate-500">{formatDate(data.date)} is not a configured workday.</p>}
          </CardBody>
          {data.rows.length === 0 ? (
            <EmptyState icon={FileBarChart} title="No employees to report" />
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th>Employee</Th>
                  <Th className="hidden md:table-cell">Department</Th>
                  <Th>First IN</Th>
                  <Th className="hidden sm:table-cell">Source</Th>
                  <Th>Status</Th>
                </tr>
              </THead>
              <TBody>
                {data.rows.map((r) => (
                  <Tr key={r.employee.id}>
                    <Td>
                      <span className="block font-medium text-slate-900">{r.employee.full_name}</span>
                      <span className="tabular block text-xs text-slate-500">{r.employee.employee_number}</span>
                    </Td>
                    <Td className="hidden md:table-cell">{r.employee.department || '—'}</Td>
                    <Td className="tabular">
                      {r.event_id ? (
                        <Link to={`/admin/attendance/${r.event_id}`} className="font-medium text-brand-700 hover:text-brand-800">
                          {formatTime(r.first_in)}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td className="hidden capitalize sm:table-cell">{r.source ?? '—'}</Td>
                    <Td>
                      <DayStateBadge state={r.state} />
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      )}
    </>
  )
}

function MonthlyTab({ isAdmin }: { isAdmin: boolean }) {
  const [params, setParams] = useSearchParams()
  const month = params.get('month') ?? isoDate().slice(0, 7)
  const { data, error, reload, loading } = useApi<MonthlyReport>(withQuery('/reports/monthly', { month }))
  const exporter = useExport()

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Month</span>
          <Input type="month" value={month} max={isoDate().slice(0, 7)} onChange={(e) => setParams({ tab: 'monthly', month: e.target.value }, { replace: true })} />
        </label>
        {isAdmin && (
          <Button variant="secondary" icon={Download} loading={exporter.busy} onClick={() => exporter.run('/reports/monthly/export', { month })}>
            Export CSV
          </Button>
        )}
      </div>
      {!data ? (
        error ? <ErrorState error={error} onRetry={reload} /> : <LoadingBlock />
      ) : (
        <div className={loading ? 'opacity-60' : undefined}>
          <CardBody className="space-y-4">
            <PolicyNotice policy={data.policy} isAdmin={isAdmin} />
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Employees recorded IN per day</h3>
              <DailyBarChart data={data.days} height={200} label={`Employees recorded IN per day in ${data.month}`} />
            </div>
          </CardBody>
          <Table>
            <THead>
              <tr>
                <Th>Employee</Th>
                <Th className="hidden md:table-cell">Department</Th>
                <Th className="text-right">Days present</Th>
                {data.policy.configured && <Th className="text-right">Late</Th>}
                {data.policy.configured && <Th className="text-right">Absent</Th>}
              </tr>
            </THead>
            <TBody>
              {data.rows.map((r) => (
                <Tr key={r.employee.id}>
                  <Td>
                    <Link to={`/admin/attendance?employee=${r.employee.id}&from=${month}-01&to=${data.days.at(-1)?.date ?? ''}`} className="group block">
                      <span className="block font-medium text-slate-900 group-hover:text-brand-700">{r.employee.full_name}</span>
                      <span className="tabular block text-xs text-slate-500">{r.employee.employee_number}</span>
                    </Link>
                  </Td>
                  <Td className="hidden md:table-cell">{r.employee.department || '—'}</Td>
                  <Td className="tabular text-right font-medium">{r.days_present}</Td>
                  {data.policy.configured && <Td className={clsx('tabular text-right', r.late_days ? 'text-amber-700' : '')}>{r.late_days}</Td>}
                  {data.policy.configured && (
                    <Td className="tabular text-right">
                      {r.absent_days}
                      <span className="text-slate-400"> / {data.workdays_elapsed}</span>
                    </Td>
                  )}
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </>
  )
}

export function ReportsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'monthly' ? 'monthly' : 'daily'

  return (
    <>
      <PageHeader title="Reports" description="Daily and monthly attendance summaries. Exports are recorded in the audit log." />
      <Card>
        <div role="tablist" aria-label="Report type" className="flex gap-1 border-b border-slate-200 px-2 sm:px-3">
          {(['daily', 'monthly'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setParams({ tab: t }, { replace: true })}
              className={clsx(
                '-mb-px border-b-2 px-3 py-3 text-sm font-medium capitalize',
                tab === t ? 'border-brand-700 text-brand-800' : 'border-transparent text-slate-500 hover:text-slate-800',
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <CardHeader title={tab === 'daily' ? 'Daily attendance' : 'Monthly summary'} className="sr-only" />
        <div role="tabpanel">{tab === 'daily' ? <DailyTab isAdmin={isAdmin} /> : <MonthlyTab isAdmin={isAdmin} />}</div>
      </Card>
    </>
  )
}
