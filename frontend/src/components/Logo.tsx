import clsx from 'clsx'
import { ScanFace } from 'lucide-react'

export function Logo({ inverted = false, className }: { inverted?: boolean; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-2.5', className)}>
      <span
        className={clsx(
          'flex size-8 items-center justify-center rounded-md',
          inverted ? 'bg-white/10 text-brand-200 ring-1 ring-white/15' : 'bg-ink-900 text-brand-200',
        )}
      >
        <ScanFace size={18} aria-hidden />
      </span>
      <span className={clsx('text-[15px] font-semibold tracking-tight', inverted ? 'text-white' : 'text-slate-900')}>
        SmartFace
      </span>
    </span>
  )
}
