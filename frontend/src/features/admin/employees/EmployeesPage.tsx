import { Download, Plus, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { Badge } from '../../../components/ui/Badge'
import { Button, ButtonLink } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { EmptyState, ErrorState, LoadingBlock } from '../../../components/ui/Feedback'
import { SearchInput, Select } from '../../../components/ui/Field'
import { PageHeader } from '../../../components/ui/PageHeader'
import { Pagination, Table, TBody, Td, Th, THead, Tr } from '../../../components/ui/Table'
import { useToast } from '../../../components/ui/Toast'
import { useApi, useDebounced } from '../../../hooks/useApi'
import { downloadFile, errorMessage, withQuery } from '../../../lib/api'
import type { Employee, Paginated } from '../../../types/api'
import { useAuth } from '../../auth/AuthContext'
import { EmployeeStatusBadge } from '../../shared/StatusBadges'

const PAGE_SIZE = 25

export function EmployeesPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('search') ?? '')
  const debounced = useDebounced(search)
  const page = Number(params.get('page') ?? 1)
  const filters = {
    search: params.get('search') ?? '',
    status: params.get('status') ?? '',
    department: params.get('department') ?? '',
    enrolled: params.get('enrolled') ?? '',
  }

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params)
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

  const { data, error, loading, reload } = useApi<Paginated<Employee>>(
    withQuery('/employees', { ...filters, page, page_size: PAGE_SIZE }),
  )
  const { data: departments } = useApi<string[]>('/employees/departments')
  const [exporting, setExporting] = useState(false)

  const exportCsv = async () => {
    setExporting(true)
    try {
      await downloadFile('/employees/export', filters, 'employees.csv')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <>
      <PageHeader
        title="Employees"
        description="Employee records, enrollment status and portal access."
        actions={
          isAdmin && (
            <>
              <Button variant="secondary" icon={Download} onClick={exportCsv} loading={exporting}>
                Export CSV
              </Button>
              <ButtonLink to="/admin/employees/new" icon={Plus}>
                Add employee
              </ButtonLink>
            </>
          )
        }
      />

      <Card>
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <SearchInput
            placeholder="Search name, number or email"
            aria-label="Search employees"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select aria-label="Status" value={filters.status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
          <Select aria-label="Department" value={filters.department} onChange={(e) => update({ department: e.target.value })}>
            <option value="">All departments</option>
            {departments?.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
          <Select aria-label="Enrollment" value={filters.enrolled} onChange={(e) => update({ enrolled: e.target.value })}>
            <option value="">Any enrollment</option>
            <option value="true">Enrolled</option>
            <option value="false">Not enrolled</option>
          </Select>
        </div>

        {error && !data ? (
          <ErrorState error={error} onRetry={reload} />
        ) : !data ? (
          <LoadingBlock />
        ) : data.results.length === 0 ? (
          <EmptyState
            icon={Users}
            title={hasFilters ? 'No employees match these filters' : 'No employees yet'}
            description={hasFilters ? 'Try a different search or clear the filters.' : 'Add your first employee to start enrollment.'}
            action={
              hasFilters ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearch('')
                    setParams(new URLSearchParams(), { replace: true })
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                isAdmin && (
                  <ButtonLink to="/admin/employees/new" size="sm" icon={Plus}>
                    Add employee
                  </ButtonLink>
                )
              )
            }
          />
        ) : (
          <div className={loading ? 'opacity-60 transition-opacity' : undefined}>
            <Table>
              <THead>
                <tr>
                  <Th>Employee</Th>
                  <Th className="hidden md:table-cell">Department</Th>
                  <Th>Status</Th>
                  <Th className="hidden sm:table-cell">Enrollment</Th>
                  <Th className="hidden lg:table-cell">Portal</Th>
                </tr>
              </THead>
              <TBody>
                {data.results.map((e) => (
                  <Tr key={e.id}>
                    <Td>
                      <Link to={`/admin/employees/${e.id}`} className="group block min-w-0">
                        <span className="block font-medium text-slate-900 group-hover:text-brand-700">{e.full_name}</span>
                        <span className="tabular block text-xs text-slate-500">{e.employee_number}</span>
                      </Link>
                    </Td>
                    <Td className="hidden md:table-cell">
                      <span className="block">{e.department || '—'}</span>
                      <span className="block text-xs text-slate-500">{e.position}</span>
                    </Td>
                    <Td>
                      <EmployeeStatusBadge status={e.status} />
                    </Td>
                    <Td className="hidden sm:table-cell">
                      {e.enrollment.enrolled ? (
                        <Badge tone="brand">Enrolled</Badge>
                      ) : e.enrollment.has_session_in_progress ? (
                        <Badge tone="warning">In progress</Badge>
                      ) : (
                        <Badge>Not enrolled</Badge>
                      )}
                    </Td>
                    <Td className="hidden text-slate-500 lg:table-cell">{e.account ? e.account.username : 'No account'}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
            <Pagination page={page} pageSize={PAGE_SIZE} count={data.count} onPage={(p) => update({ page: String(p) })} />
          </div>
        )}
      </Card>
    </>
  )
}
