import { formatDateTime, humanize } from '../../lib/format'

function ChangeValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') return <span className="text-slate-400">empty</span>
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return <>{formatDateTime(value)}</>
  return <>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</>
}

export function AuditChanges({ changes }: { changes: Record<string, unknown> }) {
  const before = changes.before as Record<string, unknown> | undefined
  const after = changes.after as Record<string, unknown> | undefined
  if (before || after) {
    const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]))
    const changed = keys.filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]))
    if (!changed.length) return null
    return (
      <ul className="mt-1.5 space-y-0.5 text-xs text-slate-600">
        {changed.map((k) => (
          <li key={k}>
            <span className="font-medium text-slate-700">{humanize(k)}:</span> <ChangeValue value={before?.[k]} /> →{' '}
            <ChangeValue value={after?.[k]} />
          </li>
        ))}
      </ul>
    )
  }
  return null
}
