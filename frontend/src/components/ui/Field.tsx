import clsx from 'clsx'
import { Eye, EyeOff, Search } from 'lucide-react'
import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

const control =
  'block w-full rounded-md border bg-white text-sm text-slate-900 shadow-xs transition-colors ' +
  'placeholder:text-slate-400 focus:outline-none focus:ring-3 disabled:bg-slate-50 disabled:text-slate-500'

function controlClasses(invalid?: boolean, className?: string) {
  return clsx(
    control,
    invalid
      ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
      : 'border-slate-300 focus:border-brand-600 focus:ring-brand-100',
    className,
  )
}

interface FieldProps {
  label: ReactNode
  error?: string
  hint?: ReactNode
  required?: boolean
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode
  className?: string
}

/** Label + control + hint/error, with correct accessibility wiring. */
export function Field({ label, error, hint, required, children, className }: FieldProps) {
  const id = useId()
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ')
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span className="ml-0.5 text-red-600" aria-hidden>
            *
          </span>
        )}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy || undefined })}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={controlClasses(rest['aria-invalid'] === true, clsx('h-10 px-3', className))} {...rest} />
})

export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function PasswordInput({ className, ...rest }, ref) {
    const [visible, setVisible] = useState(false)
    return (
      <div className="relative">
        <input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={controlClasses(rest['aria-invalid'] === true, clsx('h-10 pr-10 pl-3', className))}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-slate-400 hover:text-slate-700"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
        </button>
      </div>
    )
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={controlClasses(rest['aria-invalid'] === true, clsx('h-10 pr-8 pl-3', className))} {...rest}>
      {children}
    </select>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={controlClasses(rest['aria-invalid'] === true, clsx('px-3 py-2', className))}
        {...rest}
      />
    )
  },
)

export const Checkbox = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }
>(function Checkbox({ label, description, className, id, ...rest }, ref) {
  const generated = useId()
  const inputId = id ?? generated
  return (
    <div className={clsx('flex gap-3', className)}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 rounded border-slate-300 accent-brand-700"
        {...rest}
      />
      <label htmlFor={inputId} className="text-sm">
        <span className="font-medium text-slate-800">{label}</span>
        {description && <span className="mt-0.5 block text-slate-500">{description}</span>}
      </label>
    </div>
  )
})

/** Inline search/filter input with a leading icon. */
export function SearchInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={clsx('relative', className)}>
      <Search
        size={16}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <input type="search" className={controlClasses(false, 'h-10 pr-3 pl-9')} {...rest} />
    </div>
  )
}
