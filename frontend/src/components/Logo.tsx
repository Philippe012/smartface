import clsx from 'clsx'

/** Official SmartFace mark (public/brand) with the wordmark. */
export function Logo({
  inverted = false,
  showText = true,
  className,
}: {
  inverted?: boolean
  showText?: boolean
  className?: string
}) {
  return (
    <span className={clsx('group inline-flex items-center gap-2.5', className)}>
      <img
        src="/brand/logo-64.png"
        srcSet="/brand/logo-64.png 1x, /brand/logo-192.png 3x"
        alt=""
        width={32}
        height={32}
        className="size-8 rounded-lg shadow-[0_0_0_1px_rgb(42_245_160/0.18),0_4px_14px_-4px_rgb(25_227_240/0.45)] transition-transform duration-300 group-hover:scale-105"
      />
      {showText && (
        <span className={clsx('text-[15px] font-semibold tracking-tight', inverted ? 'text-white' : 'text-slate-900')}>
          Smart<span className="text-gradient">Face</span>
        </span>
      )}
    </span>
  )
}
