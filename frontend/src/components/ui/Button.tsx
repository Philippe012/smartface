import clsx from 'clsx'
import { LoaderCircle } from 'lucide-react'
import type { ButtonHTMLAttributes, ComponentType, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-outline'
type Size = 'sm' | 'md'

const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ' +
  'disabled:cursor-not-allowed disabled:opacity-55'

const variants: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white shadow-xs hover:bg-brand-800',
  secondary: 'border border-slate-300 bg-white text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger: 'bg-red-600 text-white shadow-xs hover:bg-red-700',
  'danger-outline': 'border border-red-200 bg-white text-red-700 shadow-xs hover:bg-red-50',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
}

const iconSizes: Record<Size, number> = { sm: 15, md: 16 }

interface CommonProps {
  variant?: Variant
  size?: Size
  icon?: ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>
  children?: ReactNode
}

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return clsx(base, variants[variant], sizes[size], className)
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <LoaderCircle size={iconSizes[size]} className="animate-spin" aria-hidden />
      ) : (
        Icon && <Icon size={iconSizes[size]} aria-hidden />
      )}
      {children}
    </button>
  )
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  className,
  children,
  ...rest
}: CommonProps & LinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...rest}>
      {Icon && <Icon size={iconSizes[size]} aria-hidden />}
      {children}
    </Link>
  )
}

export function IconButton({
  label,
  icon: Icon,
  className,
  ...rest
}: { label: string; icon: CommonProps['icon'] } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        'inline-flex size-9 items-center justify-center rounded-md text-slate-500 transition-colors',
        'hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600',
        className,
      )}
      {...rest}
    >
      {Icon && <Icon size={18} aria-hidden />}
    </button>
  )
}
