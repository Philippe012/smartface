import { zodResolver } from '@hookform/resolvers/zod'
import { LogIn } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'

import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Feedback'
import { Field, Input, PasswordInput } from '../../components/ui/Field'
import { AuthLayout } from '../../layouts/AuthLayout'
import { errorMessage } from '../../lib/api'
import { homeFor, useAuth } from './AuthContext'

const schema = z.object({
  username: z.string().trim().min(1, 'Enter your username.'),
  password: z.string().min(1, 'Enter your password.'),
})
type Values = z.infer<typeof schema>

export function LoginPage() {
  const { user, login, connectionError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  if (user) return <Navigate to={homeFor(user.role)} replace />

  const onSubmit = async (values: Values) => {
    setError(null)
    try {
      const me = await login(values.username, values.password)
      const target = from && from.startsWith(me.role === 'employee' ? '/employee' : '/admin') ? from : homeFor(me.role)
      navigate(target, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      description="Use the account provided by your SmartFace administrator."
      footer={
        <p>
          Employees without an account can ask an administrator for portal access.{' '}
          <Link to="/" className="font-medium text-slate-700 hover:text-slate-900">
            About SmartFace
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {(error || connectionError) && <Alert tone="danger">{error ?? connectionError}</Alert>}
        <Field label="Username" error={errors.username?.message}>
          {(props) => <Input {...props} {...register('username')} autoComplete="username" autoFocus />}
        </Field>
        <Field label="Password" error={errors.password?.message}>
          {(props) => <PasswordInput {...props} {...register('password')} autoComplete="current-password" />}
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-brand-700 hover:text-brand-800">
            Forgot your password?
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={isSubmitting} icon={LogIn}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}
