import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { formatDate } from '../../lib/format'
import { useTheme } from '../theme/ThemeContext'

// Single-series column chart (no legend needed for one series); colours follow the theme.
const PALETTE = {
  light: { series: '#0d9488', grid: '#e2e8f0', axis: '#cbd5e1', tick: '#64748b', cursor: '#f1f5f9' },
  dark: { series: '#2ee0c0', grid: '#1b2e41', axis: '#2a4057', tick: '#8b9fb4', cursor: 'rgba(36, 204, 180, 0.08)' },
}

interface Point {
  date: string
  present: number
}

function ChartTooltip({ active, payload, color }: { active?: boolean; payload?: { payload: Point }[]; color: string }) {
  if (!active || !payload?.length) return null
  const p = payload[0]!.payload
  return (
    <div className="rounded-md border border-slate-200 bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-slate-900">{formatDate(p.date)}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-slate-600">
        <span className="size-2 rounded-sm" style={{ background: color }} aria-hidden />
        <span className="tabular font-semibold text-slate-900">{p.present}</span> employees recorded IN
      </p>
    </div>
  )
}

export function DailyBarChart({ data, height = 220, label }: { data: Point[]; height?: number; label: string }) {
  const c = PALETTE[useTheme().resolved]
  const tick = (value: string) => {
    const d = new Date(`${value}T00:00:00`)
    return data.length > 16 ? String(d.getDate()) : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  }
  return (
    <figure>
      <div style={{ height }} role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -24 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke={c.grid} strokeWidth={1} />
            <XAxis
              dataKey="date"
              tickFormatter={tick}
              tickLine={false}
              axisLine={{ stroke: c.axis }}
              tick={{ fontSize: 11, fill: c.tick }}
              interval="preserveStartEnd"
              minTickGap={8}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: c.tick }}
              width={48}
            />
            <Tooltip content={<ChartTooltip color={c.series} />} cursor={{ fill: c.cursor }} />
            <Bar dataKey="present" fill={c.series} radius={[6, 6, 0, 0]} maxBarSize={24} animationDuration={700} />
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
