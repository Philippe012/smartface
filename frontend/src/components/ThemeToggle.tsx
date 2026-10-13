import clsx from 'clsx'
import { Check, Monitor, Moon, Sun } from 'lucide-react'

import { useTheme } from '../features/theme/ThemeContext'
import type { ThemePreference } from '../lib/theme'

/** Compact sun/moon switch for headers. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, toggle } = useTheme()
  const dark = resolved === 'dark'
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={clsx(
        'relative inline-flex size-9 items-center justify-center overflow-hidden rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900',
        className,
      )}
    >
      <Sun
        size={18}
        aria-hidden
        className={clsx('absolute transition-all duration-500', dark ? 'translate-y-6 rotate-90 opacity-0' : 'translate-y-0 rotate-0 opacity-100')}
      />
      <Moon
        size={18}
        aria-hidden
        className={clsx('absolute transition-all duration-500', dark ? 'translate-y-0 rotate-0 opacity-100' : '-translate-y-6 -rotate-90 opacity-0')}
      />
    </button>
  )
}

const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Device', icon: Monitor },
]

function Preview({ mode }: { mode: ThemePreference }) {
  const pane = (dark: boolean) => (
    <div className={clsx('flex h-full flex-1 gap-1.5 p-2', dark ? 'bg-[#050f19]' : 'bg-[#f6f8fb]')}>
      <div className={clsx('w-1/4 rounded-sm', dark ? 'bg-[#0b1825]' : 'bg-white')} />
      <div className="flex flex-1 flex-col gap-1.5">
        <div className={clsx('h-2 w-2/3 rounded-full', dark ? 'bg-[#2a4057]' : 'bg-[#cbd5e1]')} />
        <div className={clsx('flex-1 rounded-sm', dark ? 'bg-[#0b1825]' : 'bg-white')}>
          <div className={clsx('m-1.5 h-1.5 w-1/2 rounded-full', dark ? 'bg-[#2ee0c0]' : 'bg-[#0a7467]')} />
        </div>
      </div>
    </div>
  )
  return (
    <div className="flex h-20 overflow-hidden rounded-md ring-1 ring-slate-200" aria-hidden>
      {mode === 'system' ? (
        <>
          {pane(false)}
          {pane(true)}
        </>
      ) : (
        pane(mode === 'dark')
      )}
    </div>
  )
}

/** Appearance picker used on account settings pages. */
export function ThemeSelector() {
  const { preference, setPreference } = useTheme()
  return (
    <div role="radiogroup" aria-label="Theme" className="grid gap-3 sm:grid-cols-3">
      {options.map((o) => {
        const active = preference === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => void setPreference(o.value)}
            className={clsx(
              'group relative rounded-lg border p-2.5 text-left transition-all duration-200',
              active
                ? 'border-brand-500 bg-brand-50 shadow-[0_0_0_3px] shadow-brand-200'
                : 'border-slate-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md',
            )}
          >
            <Preview mode={o.value} />
            <span className="mt-2.5 flex items-center gap-2 px-0.5 text-sm font-medium text-slate-800">
              <o.icon size={15} className={active ? 'text-brand-700' : 'text-slate-400'} aria-hidden />
              {o.label}
              {active && <Check size={15} className="ml-auto text-brand-700" aria-hidden />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
