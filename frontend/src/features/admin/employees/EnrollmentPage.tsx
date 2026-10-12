import clsx from 'clsx'
import {
  Camera as CameraIcon,
  CameraOff,
  CircleCheck,
  CircleDot,
  RotateCcw,
  ScanFace,
  ShieldCheck,
  Trash2,
  Video,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router'

import { Badge } from '../../../components/ui/Badge'
import { Button, ButtonLink } from '../../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../../components/ui/Card'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { Alert, ErrorState, LoadingBlock } from '../../../components/ui/Feedback'
import { Checkbox, Field, Select } from '../../../components/ui/Field'
import { PageHeader } from '../../../components/ui/PageHeader'
import { useToast } from '../../../components/ui/Toast'
import { useApi } from '../../../hooks/useApi'
import { api, errorMessage } from '../../../lib/api'
import type { Camera, Employee, EnrollmentSession, SampleResult, SystemSettings } from '../../../types/api'

const CONSENT_METHODS = ['Signed paper consent form', 'Digital acknowledgement', 'Other documented authorisation']

function ConsentStep({ employee, onStarted }: { employee: Employee; onStarted: (s: EnrollmentSession) => void }) {
  const { data: settings } = useApi<SystemSettings>('/settings')
  const [identity, setIdentity] = useState(false)
  const [consent, setConsent] = useState(false)
  const [method, setMethod] = useState(CONSENT_METHODS[0]!)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = async () => {
    setBusy(true)
    setError(null)
    try {
      onStarted(
        await api<EnrollmentSession>(`/employees/${employee.id}/enrollments`, {
          method: 'POST',
          body: { consent_confirmed: consent, identity_verified: identity, consent_method: method },
        }),
      )
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader title="Step 1 · Notice and consent" description="Complete these steps before any face images are captured." />
      <CardBody className="space-y-5">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <ShieldCheck size={14} aria-hidden />
            Privacy notice {settings && `· version ${settings.privacy_notice_version}`}
          </p>
          <p className="mt-2 text-sm whitespace-pre-line text-slate-700">{settings?.privacy_notice ?? 'Loading notice…'}</p>
          {settings?.alternative_method && (
            <p className="mt-3 text-sm text-slate-700">
              <span className="font-medium">Alternative: </span>
              {settings.alternative_method}
            </p>
          )}
        </div>
        <Checkbox
          checked={identity}
          onChange={(e) => setIdentity(e.target.checked)}
          label={`I have verified that the person present is ${employee.full_name} (${employee.employee_number})`}
          description="Use your organisation's approved identity check."
        />
        <Checkbox
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          label="The employee has received the notice and their consent or authorisation is documented"
          description="They were told about the manual alternative and how to request deletion or correction."
        />
        <Field label="How consent or authorisation was recorded" className="max-w-sm">
          {(p) => (
            <Select {...p} value={method} onChange={(e) => setMethod(e.target.value)}>
              {CONSENT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          )}
        </Field>
      </CardBody>
      <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
        <Button icon={ScanFace} disabled={!identity || !consent} loading={busy} onClick={start}>
          Start capture
        </Button>
      </div>
    </Card>
  )
}

type Source = 'webcam' | `camera:${number}`

function useWebcam(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [state, setState] = useState<'idle' | 'starting' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('error')
      setError('This browser cannot access a camera here. Open SmartFace over HTTPS (or on localhost), or capture from a configured camera instead.')
      return
    }
    let cancelled = false
    setState('starting')
    navigator.mediaDevices
      .getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play()
        }
        setState('ready')
        setError(null)
      })
      .catch((err: DOMException) => {
        setState('error')
        setError(
          err.name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow camera access in the browser settings and try again.'
            : err.name === 'NotFoundError'
              ? 'No camera was found on this device.'
              : `The camera could not be started (${err.name}). It may be in use by another application.`,
        )
      })
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [enabled])

  const capture = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92))
  }, [])

  return { videoRef, state, error, capture }
}

function CaptureStep({ session: initial, onDone }: { session: EnrollmentSession; onDone: (s: EnrollmentSession) => void }) {
  const toast = useToast()
  const [session, setSession] = useState(initial)
  const [source, setSource] = useState<Source>('webcam')
  const { data: cameras } = useApi<Paginated>('/cameras')
  const webcam = useWebcam(source === 'webcam')
  const captured = useMemo(() => new Map(session.samples.map((s) => [s.pose, s])), [session.samples])
  const firstMissing = session.poses.find((p) => !captured.has(p.key))?.key ?? session.poses[0]!.key
  const [pose, setPose] = useState(firstMissing)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SampleResult | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [finishing, setFinishing] = useState(false)

  const activeCameras = (cameras?.results ?? []).filter((c) => c.is_active)
  const currentPose = session.poses.find((p) => p.key === pose)!

  const applyResult = (res: SampleResult) => {
    setResult(res)
    setSession(res.session)
    if (res.accepted) {
      const done = new Set(res.session.samples.map((s) => s.pose))
      const next = res.session.poses.find((p) => !done.has(p.key))
      if (next) setPose(next.key)
    }
  }

  const capture = async () => {
    setBusy(true)
    setResult(null)
    try {
      if (source === 'webcam') {
        const blob = await webcam.capture()
        if (!blob) throw new Error('No video frame is available yet.')
        const form = new FormData()
        form.append('image', blob, 'capture.jpg')
        form.append('pose', pose)
        applyResult(await api<SampleResult>(`/enrollments/${session.id}/samples`, { method: 'POST', body: form }))
      } else {
        const cameraId = Number(source.split(':')[1])
        applyResult(
          await api<SampleResult>(`/enrollments/${session.id}/capture`, { method: 'POST', body: { camera_id: cameraId, pose } }),
        )
      }
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const removeSample = async (sampleId: number) => {
    try {
      setSession(await api<EnrollmentSession>(`/enrollments/${session.id}/samples/${sampleId}`, { method: 'DELETE' }))
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const finish = async () => {
    setFinishing(true)
    try {
      onDone(await api<EnrollmentSession>(`/enrollments/${session.id}/complete`, { method: 'POST' }))
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setFinishing(false)
    }
  }

  const cancel = async () => {
    onDone(await api<EnrollmentSession>(`/enrollments/${session.id}/cancel`, { method: 'POST' }))
  }

  const count = session.samples.length
  const ready = count >= session.min_samples

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <CardHeader
          title="Step 2 · Capture face samples"
          description="Good, even lighting. One person in view. No hats or sunglasses."
          actions={
            <Select aria-label="Capture source" value={source} onChange={(e) => setSource(e.target.value as Source)} className="w-auto">
              <option value="webcam">This device's camera</option>
              {activeCameras.map((c) => (
                <option key={c.id} value={`camera:${c.id}`}>
                  {c.name}
                </option>
              ))}
            </Select>
          }
        />
        <CardBody className="space-y-4">
          <div className="relative aspect-video overflow-hidden rounded-md bg-slate-900">
            {source === 'webcam' ? (
              <>
                <video ref={webcam.videoRef} className="size-full -scale-x-100 object-cover" playsInline muted aria-label="Live camera preview" />
                {webcam.state === 'ready' && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
                    <div className="h-[72%] aspect-[3/4] rounded-[50%] border-2 border-dashed border-white/70" />
                  </div>
                )}
                {webcam.state !== 'ready' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-300">
                    {webcam.state === 'error' ? <CameraOff size={28} aria-hidden /> : <Video size={28} aria-hidden />}
                    <p className="max-w-sm">{webcam.error ?? 'Starting camera…'}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-300">
                <CameraIcon size={28} aria-hidden />
                <p className="max-w-sm">
                  A single frame is taken from the selected camera when you press Capture. Ask the employee to stand in
                  front of it, facing as instructed.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-md border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Current pose</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">{currentPose.label}</p>
            </div>
            <Button
              icon={CameraIcon}
              onClick={capture}
              loading={busy}
              disabled={source === 'webcam' && webcam.state !== 'ready'}
              className="sm:min-w-36"
            >
              {captured.has(pose) ? 'Retake' : 'Capture'}
            </Button>
          </div>

          {result &&
            (result.accepted ? (
              <Alert tone="success" title="Sample accepted">
                Quality score {Math.round((result.quality?.score ?? 0) * 100)}/100. The image was discarded after the
                template was created.
              </Alert>
            ) : (
              <Alert tone="warning" title="Sample rejected">
                <ul className="list-disc space-y-0.5 pl-4">
                  {result.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </Alert>
            ))}
        </CardBody>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Poses" description={`${count} of ${session.poses.length} captured · minimum ${session.min_samples}`} />
          <ul className="divide-y divide-slate-100">
            {session.poses.map((p) => {
              const sample = captured.get(p.key)
              const selected = p.key === pose
              return (
                <li key={p.key} className={clsx('flex items-center gap-2 pr-3', selected && 'bg-brand-50/60')}>
                  <button
                    type="button"
                    onClick={() => setPose(p.key)}
                    aria-current={selected ? 'step' : undefined}
                    className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left"
                  >
                    {sample ? (
                      <CircleCheck size={18} className="shrink-0 text-emerald-600" aria-label="Captured" />
                    ) : (
                      <CircleDot size={18} className={clsx('shrink-0', selected ? 'text-brand-700' : 'text-slate-300')} aria-label="Not captured" />
                    )}
                    <span className={clsx('truncate text-sm', selected ? 'font-medium text-slate-900' : 'text-slate-600')}>{p.label}</span>
                  </button>
                  {sample && (
                    <button
                      type="button"
                      onClick={() => removeSample(sample.id)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                      aria-label={`Remove sample: ${p.label}`}
                    >
                      <Trash2 size={15} aria-hidden />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="space-y-2 border-t border-slate-200 p-4">
            <Button className="w-full" icon={ShieldCheck} disabled={!ready} loading={finishing} onClick={finish}>
              Finish enrollment
            </Button>
            <Button className="w-full" variant="ghost" icon={RotateCcw} onClick={() => setConfirmCancel(true)}>
              Cancel and discard samples
            </Button>
          </div>
        </Card>
        <p className="px-1 text-xs text-slate-500">
          Images are processed in memory on the server and never stored. Only encrypted templates are kept. Finishing
          replaces any previous enrollment for this employee.
        </p>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={cancel}
        title="Cancel this enrollment?"
        description="All samples captured in this session are deleted. Any previous enrollment stays active."
        confirmLabel="Cancel enrollment"
        danger
      />
    </div>
  )
}

type Paginated = { results: Camera[] }

export function EnrollmentPage() {
  const { id } = useParams()
  const { data: employee, error, reload } = useApi<Employee>(`/employees/${id}`)
  const { data: sessions } = useApi<EnrollmentSession[]>(`/employees/${id}/enrollments`)
  const [session, setSession] = useState<EnrollmentSession | null>(null)
  const [finished, setFinished] = useState<EnrollmentSession | null>(null)
  const open = session ?? sessions?.find((s) => s.status === 'in_progress') ?? null

  const back = { to: `/admin/employees/${id}`, label: 'Back to employee' }

  if (!employee || !sessions) {
    return (
      <>
        <PageHeader title="Face enrollment" back={back} />
        <Card>{error ? <ErrorState error={error} onRetry={reload} /> : <LoadingBlock />}</Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Face enrollment"
        documentTitle={`Enroll ${employee.full_name}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {employee.full_name} · {employee.employee_number}
            {employee.enrollment.enrolled && <Badge tone="brand">Currently enrolled</Badge>}
          </span>
        }
        back={back}
      />

      {employee.status !== 'active' ? (
        <Alert tone="warning">Only active employees can be enrolled. Reactivate the employee first.</Alert>
      ) : finished ? (
        <Card className="max-w-xl">
          <CardBody className="py-8 text-center">
            {finished.status === 'completed' ? (
              <>
                <CircleCheck size={36} className="mx-auto text-emerald-600" aria-hidden />
                <h2 className="mt-3 text-lg font-semibold text-slate-900">Enrollment complete</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {finished.samples.length} templates are active. {employee.first_name} can now be recognised by IN cameras
                  while the recognition service is running.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-slate-900">Enrollment cancelled</h2>
                <p className="mt-1 text-sm text-slate-500">Samples from this session were deleted.</p>
              </>
            )}
            <ButtonLink to={back.to} className="mt-6">
              Return to employee
            </ButtonLink>
          </CardBody>
        </Card>
      ) : open ? (
        <CaptureStep session={open} onDone={setFinished} />
      ) : (
        <ConsentStep employee={employee} onStarted={setSession} />
      )}
    </>
  )
}
