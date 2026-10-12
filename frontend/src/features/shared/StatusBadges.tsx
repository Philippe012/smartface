import { Badge, type Tone } from '../../components/ui/Badge'
import type {
  CameraHealth,
  CorrectionKind,
  CorrectionStatus,
  DayState,
  EventStatus,
  MatchStatus,
  WorkerStatus,
} from '../../types/api'

const eventStatus: Record<EventStatus, [Tone, string]> = {
  confirmed: ['success', 'Confirmed'],
  pending_review: ['warning', 'Needs review'],
  rejected: ['neutral', 'Rejected'],
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  const [tone, label] = eventStatus[status]
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  )
}

const matchStatus: Record<MatchStatus, [Tone, string]> = {
  matched: ['brand', 'Face match'],
  uncertain: ['warning', 'Uncertain'],
  unknown: ['neutral', 'Unknown face'],
  manual: ['info', 'Manual entry'],
  reviewed: ['info', 'Reviewed'],
}

export function MatchBadge({ status }: { status: MatchStatus }) {
  const [tone, label] = matchStatus[status]
  return <Badge tone={tone}>{label}</Badge>
}

const health: Record<CameraHealth, [Tone, string]> = {
  online: ['success', 'Online'],
  offline: ['danger', 'Offline'],
  error: ['danger', 'Error'],
  never_connected: ['neutral', 'Not connected yet'],
  disabled: ['neutral', 'Disabled'],
}

export function CameraHealthBadge({ value }: { value: CameraHealth }) {
  const [tone, label] = health[value]
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  )
}

export function WorkerBadge({ worker }: { worker: WorkerStatus }) {
  const map: Record<WorkerStatus['state'], [Tone, string]> = {
    running: ['success', 'Running'],
    stopped: ['danger', 'Stopped'],
    not_started: ['neutral', 'Not started'],
  }
  const [tone, label] = map[worker.state]
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  )
}

const dayState: Record<DayState, [Tone, string]> = {
  present: ['success', 'Present'],
  on_time: ['success', 'On time'],
  late: ['warning', 'Late'],
  absent: ['danger', 'Absent'],
  no_record: ['neutral', 'No record'],
}

export function DayStateBadge({ state }: { state: DayState }) {
  const [tone, label] = dayState[state]
  return <Badge tone={tone}>{label}</Badge>
}

const correctionStatus: Record<CorrectionStatus, [Tone, string]> = {
  pending: ['warning', 'Pending'],
  approved: ['success', 'Approved'],
  rejected: ['danger', 'Rejected'],
  cancelled: ['neutral', 'Cancelled'],
}

export function CorrectionStatusBadge({ status }: { status: CorrectionStatus }) {
  const [tone, label] = correctionStatus[status]
  return <Badge tone={tone}>{label}</Badge>
}

export const correctionKindLabel: Record<CorrectionKind, string> = {
  missing: 'Missing attendance',
  wrong_time: 'Wrong time',
  not_me: 'Record is not mine',
  other: 'Other',
}

export function EmployeeStatusBadge({ status }: { status: 'active' | 'inactive' }) {
  return status === 'active' ? (
    <Badge tone="success" dot>
      Active
    </Badge>
  ) : (
    <Badge tone="neutral" dot>
      Inactive
    </Badge>
  )
}

export function ConfidenceText({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-400">—</span>
  return (
    <span className="tabular text-slate-700" title="Cosine similarity of the best match. A system signal, not proof of identity.">
      {value.toFixed(2)}
    </span>
  )
}
