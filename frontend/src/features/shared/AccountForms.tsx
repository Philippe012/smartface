import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound, LogOut, Save } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ThemeSelector } from '../../components/ThemeToggle'
import { Button } from '../../components/ui/Button'
import { Card, CardBody, CardHeader, DetailList } from '../../components/ui/Card'
import { Alert } from '../../components/ui/Feedback'
import { Field, Input, PasswordInput } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'
import { useApi } from '../../hooks/useApi'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { applyServerErrors } from '../../lib/forms'
import type { CurrentUser } from '../../types/api'
import { useAuth } from '../auth/AuthContext'

/** Light / dark / device theme, saved to the signed-in account. */
export function AppearanceCard() {
  return (
    <Card>
      <CardHeader title="Appearance" description="Applies everywhere you sign in." />
      <CardBody>
        <ThemeSelector />
      </CardBody>
    </Card>
  )
}

const profileSchema = z.object({
  first_name: z.string().trim().max(150),
  last_name: z.string().trim().max(150),
  email: z.union([z.literal(''), z.email('Enter a valid email address.')]),
  phone: z.string().trim().max(32),
})
type ProfileValues = z.infer<typeof profileSchema>

export function ProfileForm() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const isEmployee = user?.role === 'employee'
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: user?.first_name ?? '',
      last_name: user?.last_name ?? '',
      email: user?.email ?? '',
      phone: user?.employee?.phone ?? '',
    },
  })
  if (!user) return null

  const submit = async (values: ProfileValues) => {
    setFormError(null)
    const body: Record<string, string> = { email: values.email }
    if (isEmployee) body.phone = values.phone
    else Object.assign(body, { first_name: values.first_name, last_name: values.last_name })
    try {
      const me = await api<CurrentUser>('/auth/me', { method: 'PATCH', body })
      setUser(me)
      reset({ ...values })
      toast.success('Your details were saved.')
    } catch (err) {
      setFormError(applyServerErrors(err, setError, ['first_name', 'last_name', 'email', 'phone']))
    }
  }

  return (
    <Card>
      <CardHeader title="Personal details" description={isEmployee ? 'Your name is maintained by an administrator from your employee record.' : undefined} />
      <form onSubmit={handleSubmit(submit)} noValidate>
        <CardBody className="space-y-5">
          {formError && <Alert tone="danger">{formError}</Alert>}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="First name" error={errors.first_name?.message}>
              {(p) => <Input {...p} {...register('first_name')} disabled={isEmployee} autoComplete="given-name" />}
            </Field>
            <Field label="Last name" error={errors.last_name?.message}>
              {(p) => <Input {...p} {...register('last_name')} disabled={isEmployee} autoComplete="family-name" />}
            </Field>
            <Field label="Email" error={errors.email?.message} hint="Used for password recovery.">
              {(p) => <Input {...p} type="email" {...register('email')} autoComplete="email" />}
            </Field>
            {isEmployee && (
              <Field label="Phone" error={errors.phone?.message}>
                {(p) => <Input {...p} type="tel" {...register('phone')} autoComplete="tel" />}
              </Field>
            )}
          </div>
          <DetailList
            items={[
              { label: 'Username', value: user.username },
              { label: 'Member since', value: formatDateTime(user.date_joined) },
            ]}
          />
        </CardBody>
        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
          <Button type="submit" icon={Save} loading={isSubmitting} disabled={!isDirty}>
            Save details
          </Button>
        </div>
      </form>
    </Card>
  )
}

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Enter your current password.'),
    new_password: z.string().min(10, 'Use at least 10 characters.'),
    confirm: z.string(),
  })
  .refine((v) => v.new_password === v.confirm, { path: ['confirm'], message: 'Passwords do not match.' })
type PasswordValues = z.infer<typeof passwordSchema>

export function PasswordChangeCard() {
  const toast = useToast()
  const { refresh } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) })

  const submit = async (values: PasswordValues) => {
    setFormError(null)
    try {
      await api('/auth/password/change', {
        method: 'POST',
        body: { current_password: values.current_password, new_password: values.new_password },
      })
      reset({ current_password: '', new_password: '', confirm: '' })
      toast.success('Password changed. Other sessions were signed out.')
      void refresh()
    } catch (err) {
      setFormError(applyServerErrors(err, setError, ['current_password', 'new_password']))
    }
  }

  return (
    <Card>
      <CardHeader title="Change password" description="At least 10 characters. Avoid common passwords and passwords you use elsewhere." />
      <form onSubmit={handleSubmit(submit)} noValidate>
        <CardBody className="max-w-md space-y-4">
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Field label="Current password" error={errors.current_password?.message}>
            {(p) => <PasswordInput {...p} {...register('current_password')} autoComplete="current-password" />}
          </Field>
          <Field label="New password" error={errors.new_password?.message}>
            {(p) => <PasswordInput {...p} {...register('new_password')} autoComplete="new-password" />}
          </Field>
          <Field label="Confirm new password" error={errors.confirm?.message}>
            {(p) => <PasswordInput {...p} {...register('confirm')} autoComplete="new-password" />}
          </Field>
        </CardBody>
        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
          <Button type="submit" icon={KeyRound} loading={isSubmitting}>
            Update password
          </Button>
        </div>
      </form>
    </Card>
  )
}

export function SessionsCard() {
  const { user } = useAuth()
  const toast = useToast()
  const { data, reload } = useApi<{ active_sessions: number; other_sessions: number }>('/auth/sessions')
  const [busy, setBusy] = useState(false)
  if (!user) return null

  const signOutOthers = async () => {
    setBusy(true)
    try {
      const res = await api<{ signed_out: number }>('/auth/sessions', { method: 'DELETE' })
      toast.success(res.signed_out ? `Signed out ${res.signed_out} other session(s).` : 'No other sessions were active.')
      reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader title="Sign-in activity" />
      <CardBody className="space-y-4">
        <DetailList
          items={[
            { label: 'Last sign-in', value: formatDateTime(user.last_login, 'Never') },
            { label: 'Password last changed', value: formatDateTime(user.password_changed_at, 'Not recorded') },
            { label: 'Other active sessions', value: data ? data.other_sessions : '—' },
          ]}
        />
        <p className="text-sm text-slate-500">
          Sessions expire after 8 hours or when the browser closes. If you signed in on a shared computer, sign out of
          other sessions.
        </p>
        <Button variant="secondary" icon={LogOut} loading={busy} onClick={signOutOthers} disabled={data?.other_sessions === 0}>
          Sign out other sessions
        </Button>
      </CardBody>
    </Card>
  )
}
