import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

import { ApiError } from './api'

/**
 * Copy server-side field errors onto a react-hook-form instance.
 * Returns the message to show for anything that isn't a known field.
 */
export function applyServerErrors<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  fields: readonly string[],
): string | null {
  if (!(err instanceof ApiError)) return err instanceof Error ? err.message : 'Something went wrong.'
  const leftovers: string[] = []
  for (const [field, messages] of Object.entries(err.fieldErrors)) {
    if (fields.includes(field)) {
      setError(field as Path<T>, { type: 'server', message: messages.join(' ') })
    } else {
      leftovers.push(...messages)
    }
  }
  if (leftovers.length) return leftovers.join(' ')
  return Object.keys(err.fieldErrors).length ? null : err.message
}
