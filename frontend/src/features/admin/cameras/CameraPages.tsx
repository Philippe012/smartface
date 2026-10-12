import { Activity, Camera as CameraIcon, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { Button, ButtonLink } from '../../../components/ui/Button'
import { Card, CardBody, CardHeader, DetailList } from '../../../components/ui/Card'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { Alert, EmptyState, ErrorState, LoadingBlock } from '../../../components/ui/Feedback'
import { PageHeader } from '../../../components/ui/PageHeader'
import { useToast } from '../../../components/ui/Toast'
import { useApi } from '../../../hooks/useApi'
import { api, errorMessage } from '../../../lib/api'
import { formatDateTime, formatRelative } from '../../../lib/format'
import type { Camera, Paginated, RecognitionReadiness, WorkerStatus } from '../../../types/api'
import { useAuth } from '../../auth/AuthContext'
import { CameraHealthBadge, WorkerBadge } from '../../shared/StatusBadges'
import { CameraForm } from './CameraForm'

type RecognitionStatus = RecognitionReadiness & { worker: WorkerStatus }

const sourceLabel = { rtsp: 'RTSP', http: 'HTTP/MJPEG', device: 'Local device' }

function WorkerNotice({ status }: { status?: RecognitionStatus }) {
  if (!status || status.worker.state === 'running') return null
  return (
    <Alert tone="warning" className="mb-6" title="Recognition service is not running">
      Camera health is only updated while the service runs. Start it on the server with{' '}
      <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">python manage.py run_recognition</code>. You can still
      test a connection below.
    </Alert>
  )
}

function useTestConnection(onDone: (camera: Camera) => void) {
  const toast = useToast()
  const [testing, setTesting] = useState<number | null>(null)
  const test = async (camera: Camera) => {
    setTesting(camera.id)
    try {
      const res = await api<{ ok: boolean; error?: string; width?: number; height?: number; latency_ms?: number; camera: Camera }>(
        `/cameras/${camera.id}/test`,
        { method: 'POST' },
      )
      if (res.ok) toast.success(`${camera.name}: connected, ${res.width}×${res.height}, first frame in ${res.latency_ms} ms.`)
      else toast.error(`${camera.name}: ${res.error}`)
      onDone(res.camera)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setTesting(null)
    }
  }
  return { testing, test }
}

export function CamerasPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { data, error, reload } = useApi<Paginated<Camera>>('/cameras', { refreshMs: 15_000 })
  const { data: status } = useApi<RecognitionStatus>('/recognition/status', { refreshMs: 15_000 })
  const { testing, test } = useTestConnection(() => reload())

  return (
    <>
      <PageHeader
        title="Cameras"
        description="Local cameras processed by the recognition service. Health reflects frames actually received."
        actions={
          isAdmin && (
            <ButtonLink to="/admin/cameras/new" icon={Plus}>
              Add camera
            </ButtonLink>
          )
        }
      />
      <WorkerNotice status={status} />
      {!data ? (
        <Card>{error ? <ErrorState error={error} onRetry={reload} /> : <LoadingBlock />}</Card>
      ) : data.results.length === 0 ? (
        <Card>
          <EmptyState
            icon={CameraIcon}
            title="No cameras configured"
            description="Add the entrance camera to start automatic IN attendance."
            action={isAdmin && <ButtonLink to="/admin/cameras/new" icon={Plus} size="sm">Add camera</ButtonLink>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.results.map((c) => (
            <Card key={c.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
                <div className="min-w-0">
                  <Link to={`/admin/cameras/${c.id}`} className="block truncate font-semibold text-slate-900 hover:text-brand-700">
                    {c.name}
                  </Link>
                  <p className="truncate text-sm text-slate-500">{c.location || 'No location set'}</p>
                </div>
                <CameraHealthBadge value={c.health} />
              </div>
              <div className="flex-1 border-t border-slate-100 px-4 py-3 text-sm sm:px-5">
                <dl className="grid grid-cols-2 gap-y-2">
                  <dt className="text-slate-500">Direction</dt>
                  <dd className="text-right font-medium text-slate-800">{c.direction}</dd>
                  <dt className="text-slate-500">Connection</dt>
                  <dd className="text-right text-slate-800">{sourceLabel[c.source_type]}</dd>
                  <dt className="text-slate-500">Last frame</dt>
                  <dd className="text-right text-slate-800">{formatRelative(c.last_frame_at)}</dd>
                </dl>
                {c.last_error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{c.last_error}</p>}
              </div>
              <div className="flex gap-2 border-t border-slate-100 p-3">
                <Button size="sm" variant="secondary" icon={Activity} loading={testing === c.id} onClick={() => test(c)} className="flex-1">
                  Test connection
                </Button>
                <ButtonLink size="sm" variant="ghost" to={`/admin/cameras/${c.id}`}>
                  Details
                </ButtonLink>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

export function CameraNewPage() {
  const navigate = useNavigate()
  const toast = useToast()
  return (
    <>
      <PageHeader title="Add camera" back={{ to: '/admin/cameras', label: 'Cameras' }} description="Use a camera on the local network with a dedicated, view-only account." />
      <Card className="max-w-3xl">
        <CardHeader title="Camera configuration" />
        <CameraForm
          onSaved={(c) => {
            toast.success(`${c.name} added. Test the connection to confirm it works.`)
            navigate(`/admin/cameras/${c.id}`)
          }}
          onCancel={() => navigate('/admin/cameras')}
        />
      </Card>
    </>
  )
}

export function CameraDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { data: camera, error, reload, setData } = useApi<Camera>(`/cameras/${id}`, { refreshMs: 15_000 })
  const { data: status } = useApi<RecognitionStatus>('/recognition/status', { refreshMs: 15_000 })
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { testing, test } = useTestConnection(setData)
  const back = { to: '/admin/cameras', label: 'Cameras' }

  if (!camera) {
    return (
      <>
        <PageHeader title="Camera" back={back} />
        <Card>{error ? <ErrorState error={error} onRetry={reload} /> : <LoadingBlock />}</Card>
      </>
    )
  }

  const stats = status?.worker.details.stats?.[String(camera.id)]

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {camera.name}
            <CameraHealthBadge value={camera.health} />
          </span>
        }
        documentTitle={camera.name}
        description={camera.location || undefined}
        back={back}
        actions={
          <>
            <Button variant="secondary" icon={Activity} loading={testing === camera.id} onClick={() => test(camera)}>
              Test connection
            </Button>
            {isAdmin && !editing && (
              <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
          </>
        }
      />
      <WorkerNotice status={status} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={editing ? 'Edit configuration' : 'Configuration'} />
          {editing ? (
            <CameraForm
              camera={camera}
              onSaved={(c) => {
                setData(c)
                setEditing(false)
                toast.success('Camera updated.')
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <CardBody className="py-2">
              <DetailList
                items={[
                  { label: 'Direction', value: camera.direction === 'IN' ? 'Entrance (IN)' : 'Exit (OUT)' },
                  { label: 'Connection', value: sourceLabel[camera.source_type] },
                  camera.source_type === 'device'
                    ? { label: 'Device index', value: camera.device_index ?? 0 }
                    : { label: 'Stream address', value: <code className="text-xs break-all">{camera.stream_url}</code> },
                  ...(camera.source_type !== 'device'
                    ? [
                        { label: 'Username', value: camera.stream_username || '—' },
                        { label: 'Password', value: camera.has_password ? 'Saved (encrypted, hidden)' : 'Not set' },
                      ]
                    : []),
                  { label: 'Active', value: camera.is_active ? 'Yes' : 'No — paused' },
                  { label: 'Added', value: formatDateTime(camera.created_at) },
                ]}
              />
            </CardBody>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Diagnostics"
              actions={
                <Button size="sm" variant="ghost" icon={RefreshCw} onClick={reload}>
                  Refresh
                </Button>
              }
            />
            <CardBody className="py-2">
              <DetailList
                items={[
                  { label: 'Health', value: <CameraHealthBadge value={camera.health} /> },
                  { label: 'Last frame', value: camera.last_frame_at ? `${formatRelative(camera.last_frame_at)}` : 'Never received' },
                  { label: 'Last check', value: formatDateTime(camera.last_checked_at, 'Never') },
                  { label: 'Resolution', value: camera.frame_width ? `${camera.frame_width}×${camera.frame_height}` : '—' },
                  { label: 'Measured FPS', value: camera.measured_fps ?? '—' },
                  { label: 'Service', value: status ? <WorkerBadge worker={status.worker} /> : '—' },
                ]}
              />
              {camera.last_error && <Alert tone="danger" className="my-3" title="Last error">{camera.last_error}</Alert>}
            </CardBody>
          </Card>

          {stats && (
            <Card>
              <CardHeader title="Since the service started" />
              <CardBody className="py-2">
                <DetailList
                  items={[
                    { label: 'Frames analysed', value: stats.frames ?? 0 },
                    { label: 'Faces seen', value: stats.faces ?? 0 },
                    { label: 'Skipped (low quality)', value: stats.low_quality ?? 0 },
                    { label: 'Matched', value: stats.matched ?? 0 },
                    { label: 'Uncertain', value: stats.uncertain ?? 0 },
                    { label: 'Unknown', value: stats.unknown ?? 0 },
                    { label: 'IN records created', value: stats.events_created ?? 0 },
                  ]}
                />
              </CardBody>
            </Card>
          )}

          {isAdmin && (
            <Card>
              <CardHeader title="Remove camera" />
              <CardBody className="space-y-3">
                <p className="text-sm text-slate-500">Existing attendance records keep their history but lose the camera link.</p>
                <Button variant="danger-outline" icon={Trash2} className="w-full" onClick={() => setDeleting(true)}>
                  Delete camera
                </Button>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={async () => {
          await api(`/cameras/${camera.id}`, { method: 'DELETE' })
          toast.success('Camera deleted.')
          navigate('/admin/cameras', { replace: true })
        }}
        title={`Delete ${camera.name}?`}
        description="The recognition service stops processing this camera. Consider disabling it instead if you may need it again."
        confirmLabel="Delete camera"
        danger
      />
    </>
  )
}
