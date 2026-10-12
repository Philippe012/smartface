import { zodResolver } from '@hookform/resolvers/zod'
import { Save } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '../../../components/ui/Button'
import { Alert } from '../../../components/ui/Feedback'
import { Checkbox, Field, Input, PasswordInput, Select } from '../../../components/ui/Field'
import { api } from '../../../lib/api'
import { applyServerErrors } from '../../../lib/forms'
import type { Camera } from '../../../types/api'

const schema = z
  .object({
    name: z.string().trim().min(1, 'Name is required.').max(80),
    location: z.string().trim().max(120),
    source_type: z.enum(['rtsp', 'http', 'device']),
    stream_url: z.string().trim().max(500),
    device_index: z.number().int().min(0).max(20),
    stream_username: z.string().trim().max(120),
    stream_password: z.string().max(200),
    clear_password: z.boolean(),
    is_active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.source_type === 'device') return
    const prefix = v.source_type === 'rtsp' ? /^rtsps?:\/\//i : /^https?:\/\//i
    if (!prefix.test(v.stream_url)) {
      ctx.addIssue({
        code: 'custom',
        path: ['stream_url'],
        message: v.source_type === 'rtsp' ? 'Enter an rtsp:// address.' : 'Enter an http:// or https:// address.',
      })
    } else if (/:\/\/[^/]*@/.test(v.stream_url)) {
      ctx.addIssue({ code: 'custom', path: ['stream_url'], message: 'Remove credentials from the URL and use the fields below.' })
    }
  })
type Values = z.infer<typeof schema>
const FIELDS = ['name', 'location', 'source_type', 'stream_url', 'device_index', 'stream_username', 'stream_password']

export function CameraForm({ camera, onSaved, onCancel }: { camera?: Camera; onSaved: (c: Camera) => void; onCancel: () => void }) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: camera?.name ?? '',
      location: camera?.location ?? '',
      source_type: camera?.source_type ?? 'rtsp',
      stream_url: camera?.stream_url ?? '',
      device_index: camera?.device_index ?? 0,
      stream_username: camera?.stream_username ?? '',
      stream_password: '',
      clear_password: false,
      is_active: camera?.is_active ?? true,
    },
  })
  const sourceType = watch('source_type')
  const clearPassword = watch('clear_password')

  const submit = async (values: Values) => {
    setFormError(null)
    const body: Record<string, unknown> = { ...values, direction: 'IN' }
    if (values.source_type === 'device') {
      body.stream_url = ''
      body.stream_username = ''
    } else {
      delete body.device_index
    }
    if (!values.stream_password) delete body.stream_password
    try {
      onSaved(await api<Camera>(camera ? `/cameras/${camera.id}` : '/cameras', { method: camera ? 'PATCH' : 'POST', body }))
    } catch (err) {
      setFormError(applyServerErrors(err, setError, FIELDS))
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      <div className="space-y-5 px-4 py-4 sm:px-5">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Camera name" required error={errors.name?.message}>
            {(p) => <Input {...p} {...register('name')} placeholder="Main Entrance" />}
          </Field>
          <Field label="Location" error={errors.location?.message}>
            {(p) => <Input {...p} {...register('location')} placeholder="Ground floor lobby" />}
          </Field>
          <Field label="Direction" hint="This release records arrivals (IN) only. Exit cameras come in a later release.">
            {(p) => (
              <Select {...p} value="IN" disabled onChange={() => undefined}>
                <option value="IN">Entrance (IN)</option>
              </Select>
            )}
          </Field>
          <Field label="Connection type" error={errors.source_type?.message}>
            {(p) => (
              <Select {...p} {...register('source_type')}>
                <option value="rtsp">RTSP stream (IP camera)</option>
                <option value="http">HTTP / MJPEG stream</option>
                <option value="device">Local video device (USB webcam on the server)</option>
              </Select>
            )}
          </Field>
        </div>

        {sourceType === 'device' ? (
          <Field label="Device index" error={errors.device_index?.message} hint="0 is the first camera attached to the server." className="sm:max-w-xs">
            {(p) => <Input {...p} type="number" min={0} max={20} {...register('device_index', { valueAsNumber: true })} />}
          </Field>
        ) : (
          <>
            <Field
              label="Stream address"
              required
              error={errors.stream_url?.message}
              hint={sourceType === 'rtsp' ? 'Without credentials, e.g. rtsp://192.168.1.20:554/stream1' : 'e.g. http://192.168.1.20/video.mjpg'}
            >
              {(p) => <Input {...p} {...register('stream_url')} autoComplete="off" spellCheck={false} />}
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Stream username" error={errors.stream_username?.message} hint="Use a view-only camera account.">
                {(p) => <Input {...p} {...register('stream_username')} autoComplete="off" />}
              </Field>
              <Field
                label="Stream password"
                error={errors.stream_password?.message}
                hint={camera?.has_password ? 'A password is saved. Leave blank to keep it.' : 'Stored encrypted on the server and never shown again.'}
              >
                {(p) => <PasswordInput {...p} {...register('stream_password')} autoComplete="new-password" disabled={clearPassword} />}
              </Field>
            </div>
            {camera?.has_password && <Checkbox {...register('clear_password')} label="Remove the saved password" />}
          </>
        )}

        <Checkbox
          {...register('is_active')}
          label="Active"
          description="Active cameras are processed by the recognition service. Disable a camera to pause it without deleting its configuration."
        />
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" icon={Save} loading={isSubmitting}>
          {camera ? 'Save changes' : 'Add camera'}
        </Button>
      </div>
    </form>
  )
}
