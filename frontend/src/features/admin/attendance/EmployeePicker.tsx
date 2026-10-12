import { useState } from 'react'

import { SearchInput, Select } from '../../../components/ui/Field'
import { useApi, useDebounced } from '../../../hooks/useApi'
import { withQuery } from '../../../lib/api'
import type { Employee, Paginated } from '../../../types/api'

/** Search-then-select control for choosing an active employee. */
export function EmployeePicker({
  value,
  onChange,
  id,
  ...aria
}: {
  value: number | undefined
  onChange: (id: number | undefined) => void
  id?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}) {
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search, 250)
  const { data, loading } = useApi<Paginated<Employee>>(
    withQuery('/employees', { status: 'active', search: debounced, page_size: 50 }),
  )
  return (
    <div className="space-y-2">
      <SearchInput placeholder="Filter by name or number" aria-label="Filter employees" value={search} onChange={(e) => setSearch(e.target.value)} />
      <Select id={id} {...aria} value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}>
        <option value="">{loading ? 'Loading…' : `Select an employee (${data?.count ?? 0} found)`}</option>
        {data?.results.map((e) => (
          <option key={e.id} value={e.id}>
            {e.full_name} · {e.employee_number}
          </option>
        ))}
      </Select>
    </div>
  )
}
