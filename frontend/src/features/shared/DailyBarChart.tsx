import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { formatDate } from '../../lib/format'

// Single-series column chart (validated series color; no legend needed for one series).
const SERIES = '#0d9488'

interface Point {
  date: string
  present: number
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0]!.payload
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-slate-900">{formatDate(p.date)}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-slate-600">
        <span className="size-2 rounded-sm" style={{ background: SERIES }} aria-hidden />
        <span className="tabular font-semibold text-slate-900">{p.present}</span> employees recorded IN
      </p>
    </div>
  )
}

export function DailyBarChart({ data, height = 220, label }: { data: Point[]; height?: number; label: string }) {
  const tick = (value: string) => {
    const d = new Date(`${value}T00:00:00`)
    return data.length > 16 ? String(d.getDate()) : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  }
  return (
    <figure>
      <div style={{ height }} role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -24 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="#e2e8f0" strokeWidth={1} />
            <XAxis
              dataKey="date"
              tickFormatter={tick}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              tick={{ fontSize: 11, fill: '#64748b' }}
              interval="preserveStartEnd"
              minTickGap={8}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#64748b' }}
              width={48}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
            <Bar dataKey="present" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-xs text-slate-500">
        <summary className="cursor-pointer hover:text-slate-700">Show data as table</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-slate-500">
              <th className="py-1 font-medium">Date</th>
              <th className="py-1 text-right font-medium">Recorded IN</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.date} className="border-t border-slate-100 text-slate-700">
                <td className="py-1">{formatDate(p.date)}</td>
                <td className="tabular py-1 text-right">{p.present}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
