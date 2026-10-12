import { Download, ScrollText } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/Feedback'
import { Input, Select } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { Pagination, Table, TBody, Td, Th, THead, Tr } from '../../components/ui/Table'
import { useToast } from '../../components/ui/Toast'
import { useApi, useDebounced } from '../../hooks/useApi'
import { downloadFile, errorMessage, withQuery } from '../../lib/api'
import { formatDateTime, humanize } from '../../lib/format'
import type { AuditEvent, Paginated } from '../../types/api'
import { AuditChanges } from '../shared/AuditChanges'

const PAGE_SIZE = 50
const ENTITY_TYPES = ['employee', 'attendanceevent', 'correctionrequest', 'camera', 'enrollmentsession', 'user', 'systemsettings', 'backuprecord']

function SimpleChanges({ changes }: { changes: Record<string, unknown> }) {
  if ('before' in changes || 'after' in changes) return <AuditChanges changes={changes} />
  const entries = Object.entries(changes)
  if (!entries.length) return null
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
      {entries.slice(0, 6).map(([k, v]) => (
        <li key={k} className="break-all">
          <span className="font-medium text-slate-600">{humanize(k)}:</span>{' '}
          {v && typeof v === 'object' && 'before' in (v as object)
            ? `${String((v as { before: unknown }).before ?? '—')} → ${String((v as { after: unknown }).after ?? '—')}`
            : typeof v === 'object'
              ? JSON.stringify(v)
              : String(v)}
        </li>
      ))}
    </ul>
  )
}

export function AuditLogsPage() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [action, setAction] = useState(params.get('action') ?? '')
  const [actor, setActor] = useState(params.get('actor') ?? '')
  const filters = {
    action: useDebounced(action),
    actor: useDebounced(actor),
    entity_type: params.get('entity_type') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
  }
  const page = Number(params.get('page') ?? 1)
  const { data, error, reload, loading } = useApi<Paginated<AuditEvent>>(withQuery('/audit-events', { ...filters, page, page_size: PAGE_SIZE }))
  const [exporting, setExporting] = useState(false)

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Append-only record of sign-ins, enrollment, corrections, exports, configuration changes and deletions."
        actions={
          <Button
            variant="secondary"
            icon={Download}
            loading={exporting}
            onClick={async () => {
              setExporting(true)
              try {
                await downloadFile('/audit-events/export', filters)
              } catch (err) {
                toast.error(errorMessage(err))
              } finally {
                setExporting(false)
              }
            }}
          >
            Export CSV
          </Button>
        }
      />
      <Card>
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-5">
          <Input placeholder="Action, e.g. attendance" aria-label="Filter by action" value={action} onChange={(e) => setAction(e.target.value)} />
          <Input placeholder="User" aria-label="Filter by user" value={actor} onChange={(e) => setActor(e.target.value)} />
          <Select aria-label="Entity type" value={filters.entity_type} onChange={(e) => set('entity_type', e.target.value)}>
            <option value="">All entities</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Input type="date" aria-label="From date" value={filters.from} onChange={(e) => set('from', e.target.value)} />
          <Input type="date" aria-label="To date" value={filters.to} onChange={(e) => set('to', e.target.value)} />
        </div>
        {!data ? (
          error ? <ErrorState error={error} onRetry={reload} /> : <LoadingBlock />
        ) : data.results.length === 0 ? (
          <EmptyState icon={ScrollText} title="No audit events match" />
        ) : (
          <div className={loading ? 'opacity-60' : undefined}>
            <Table>
              <THead>
                <tr>
                  <Th>When</Th>
                  <Th>User</Th>
                  <Th>Action</Th>
                  <Th className="hidden md:table-cell">Details</Th>
                </tr>
              </THead>
              <TBody>
                {data.results.map((e) => (
                  <Tr key={e.id}>
                    <Td className="tabular align-top whitespace-nowrap">{formatDateTime(e.occurred_at)}</Td>
                    <Td className="align-top">
                      <span className="block font-medium text-slate-900">{e.actor_username}</span>
                      {e.ip_address && <span className="block text-xs text-slate-400">{e.ip_address}</span>}
                    </Td>
                    <Td className="align-top">
                      <code className="text-xs text-slate-800">{e.action}</code>
                      {e.entity_type && (
                        <span className="block text-xs text-slate-500">
                          {e.entity_type} #{e.entity_id}
                        </span>
                      )}
                    </Td>
                    <Td className="hidden max-w-md align-top md:table-cell">
                      {e.reason && <p className="text-sm text-slate-700">“{e.reason}”</p>}
                      <SimpleChanges changes={e.changes} />
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
            <Pagination page={page} pageSize={PAGE_SIZE} count={data.count} onPage={(p) => set('page', String(p))} />
          </div>
        )}
      </Card>
    </>
  )
}
