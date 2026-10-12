import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router'
import { z } from 'zod'

import { Button, ButtonLink } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Feedback'
import { Field, Input, PasswordInput } from '../../components/ui/Field'
import { AuthLayout } from '../../layouts/AuthLayout'
import { api } from '../../lib/api'
import { applyServerErrors } from '../../lib/forms'

const backToLogin = (
  <Link to="/login" className="inline-flex items-center gap-1.5 font-medium text-slate-700 hover:text-slate-900">
    <ArrowLeft size={15} aria-hidden />
    Back to sign in
  </Link>
)

const requestSchema = z.object({ email: z.email('Enter a valid email address.') })

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof requestSchema>>({ resolver: zodResolver(requestSchema) })

  const onSubmit = async (values: z.infer<typeof requestSchema>) => {
    setError(null)
    try {
      await api('/auth/password/reset', { method: 'POST', body: values })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      description="Enter the email address on your account and we will send you a reset link."
      footer={backToLogin}
    >
      {sent ? (
        <Alert tone="success" title="Check your email">
          If an account uses that address, a link to reset your password has been sent. The link expires in one
          hour. If nothing arrives, contact your administrator.
        </Alert>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Email address" error={errors.email?.message}>
            {(props) => <Input {...props} type="email" autoComplete="email" autoFocus {...register('email')} />}
          </Field>
          <Button type="submit" className="w-full" loading={isSubmitting} icon={MailCheck}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}

const resetSchema = z
  .object({
    new_password: z.string().min(10, 'Use at least 10 characters.'),
    confirm: z.string(),
  })
  .refine((v) => v.new_password === v.confirm, { path: ['confirm'], message: 'Passwords do not match.' })

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const uid = params.get('uid')
  const token = params.get('token')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) })

  const onSubmit = async (values: z.infer<typeof resetSchema>) => {
    setError(null)
    try {
      await api('/auth/password/reset/confirm', {
        method: 'POST',
        body: { uid, token, new_password: values.new_password },
      })
      setDone(true)
    } catch (err) {
      setError(applyServerErrors(err, setFieldError, ['new_password']))
    }
  }

  if (!uid || !token) {
    return (
      <AuthLayout title="Invalid reset link" footer={backToLogin}>
        <Alert tone="warning">
          This password reset link is incomplete. Open the link from your email again, or{' '}
          <Link to="/forgot-password" className="font-medium underline">
            request a new one
          </Link>
          .
        </Alert>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Choose a new password" description="Use at least 10 characters. Avoid common or reused passwords.">
      {done ? (
        <div className="space-y-5">
          <Alert tone="success" title="Password updated">
            Your password has been reset. You can now sign in with your new password.
          </Alert>
          <ButtonLink to="/login" className="w-full">
            Continue to sign in
          </ButtonLink>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="New password" error={errors.new_password?.message}>
            {(props) => <PasswordInput {...props} autoComplete="new-password" autoFocus {...register('new_password')} />}
          </Field>
          <Field label="Confirm new password" error={errors.confirm?.message}>
            {(props) => <PasswordInput {...props} autoComplete="new-password" {...register('confirm')} />}
          </Field>
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Reset password
          </Button>
          <div className="text-center text-sm">{backToLogin}</div>
        </form>
      )}
    </AuthLayout>
  )
}
