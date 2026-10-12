export type Role = 'admin' | 'operator' | 'employee'

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface EmployeeRef {
  id: number
  employee_number: string
  full_name: string
  department: string
}

export interface CurrentUser {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  role: Role
  employee: (EmployeeRef & { position: string; phone: string; status: EmployeeStatus }) | null
  last_login: string | null
  date_joined: string
  password_changed_at: string | null
}

export type EmployeeStatus = 'active' | 'inactive'

export interface EnrollmentSummary {
  enrolled: boolean
  template_count: number
  enrolled_at: string | null
  model_version: string | null
  has_session_in_progress: boolean
}

export interface Employee {
  id: number
  employee_number: string
  first_name: string
  last_name: string
  full_name: string
  email: string
  phone: string
  department: string
  position: string
  status: EmployeeStatus
  deactivated_at: string | null
  created_at: string
  updated_at: string
  enrollment: EnrollmentSummary
  account: { id: number; username: string; email: string; is_active: boolean; last_login: string | null } | null
}

export type Direction = 'IN' | 'OUT'
export type MatchStatus = 'matched' | 'uncertain' | 'unknown' | 'manual' | 'reviewed'
export type EventStatus = 'confirmed' | 'pending_review' | 'rejected'

export interface CameraRef {
  id: number
  name: string
  location: string
}

export interface AttendanceEvent {
  id: number
  employee: EmployeeRef | null
  candidate_employee: EmployeeRef | null
  camera: CameraRef | null
  occurred_at: string
  local_date: string
  direction: Direction
  source: 'camera' | 'manual'
  match_status: MatchStatus
  status: EventStatus
  confidence: number | null
  quality: number | null
  model_version: string
  sighting_count: number
  last_sighting_at: string | null
  notes: string
  created_by: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export type CorrectionKind = 'missing' | 'wrong_time' | 'not_me' | 'other'
export type CorrectionStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface CorrectionRequest {
  id: number
  employee: EmployeeRef
  event: { id: number; occurred_at: string; direction: Direction; status: EventStatus } | null
  kind: CorrectionKind
  requested_time: string | null
  reason: string
  status: CorrectionStatus
  requested_by: string | null
  decided_by: string | null
  decided_at: string | null
  decision_note: string
  before: Record<string, unknown>
  after: Record<string, unknown>
  created_at: string
}

export interface AuditEvent {
  id: number
  actor_username: string
  action: string
  entity_type: string
  entity_id: string
  occurred_at: string
  reason: string
  changes: Record<string, unknown>
  ip_address: string | null
}

export interface AttendanceDetail extends AttendanceEvent {
  corrections: CorrectionRequest[]
  history: AuditEvent[]
}

export type CameraHealth = 'online' | 'offline' | 'error' | 'never_connected' | 'disabled'

export interface Camera {
  id: number
  name: string
  location: string
  direction: Direction
  source_type: 'rtsp' | 'http' | 'device'
  stream_url: string
  device_index: number | null
  stream_username: string
  has_password: boolean
  is_active: boolean
  health: CameraHealth
  last_frame_at: string | null
  last_checked_at: string | null
  last_error: string
  frame_width: number | null
  frame_height: number | null
  measured_fps: number | null
  created_at: string
  updated_at: string
}

export interface WorkerStatus {
  state: 'running' | 'stopped' | 'not_started'
  last_seen_at: string | null
  details: { cameras?: number[]; enrolled_employees?: number; stats?: Record<string, Record<string, number>> }
}

export interface RecognitionReadiness {
  models_installed: boolean
  encryption_configured: boolean
  model_version: string
}

export interface Policy {
  configured: boolean
  work_start_time: string | null
  grace_minutes: number
  workdays: number[]
  timezone: string
}

export interface DashboardSummary {
  date: string
  employees: { total: number; active: number; enrolled: number }
  today: { present: number; not_recorded: number }
  pending_reviews: number
  pending_corrections: number
  trend: { date: string; present: number }[]
  recent_events: AttendanceEvent[]
  cameras: Pick<Camera, 'id' | 'name' | 'location' | 'direction' | 'health' | 'last_frame_at' | 'last_error'>[]
  services: {
    database: { state: 'ok' | 'error'; error?: string }
    recognition: RecognitionReadiness
    worker: WorkerStatus
  }
  policy: Policy
}

export type DayState = 'present' | 'no_record' | 'late' | 'on_time' | 'absent'

export interface DailyReport {
  date: string
  policy: Policy
  is_workday: boolean
  counts: Record<DayState, number>
  rows: {
    employee: EmployeeRef
    event_id: number | null
    first_in: string | null
    source: string | null
    match_status: MatchStatus | null
    camera: string | null
    state: DayState
  }[]
}

export interface MonthlyReport {
  month: string
  policy: Policy
  workdays_elapsed: number
  rows: { employee: EmployeeRef; days_present: number; late_days: number | null; absent_days: number | null }[]
  days: { date: string; present: number }[]
}

export interface Pose {
  key: string
  label: string
}

export interface EnrollmentSession {
  id: number
  employee_id: number
  status: 'in_progress' | 'completed' | 'cancelled'
  consent_method: string
  notice_version: string
  model_version: string
  started_by: string | null
  created_at: string
  completed_at: string | null
  samples: { id: number; pose: string; quality_score: number; created_at: string }[]
  min_samples: number
  poses: Pose[]
}

export interface SampleResult {
  accepted: boolean
  problems: string[]
  quality: { score: number; sharpness: number; brightness: number; face_size: number } | null
  sample_id?: number
  session: EnrollmentSession
}

export interface SystemSettings {
  organization_name: string
  dedup_interval_seconds: number
  schedule_configured: boolean
  work_start_time: string | null
  grace_minutes: number
  workdays: number[]
  match_threshold: number
  uncertain_threshold: number
  match_margin: number
  min_face_size_px: number
  min_sharpness: number
  min_detection_score: number
  frame_sample_interval_ms: number
  record_unknown_faces: boolean
  enrollment_min_samples: number
  privacy_notice: string
  privacy_notice_version: string
  alternative_method: string
  unresolved_event_retention_days: number
  attendance_retention_days: number
  audit_retention_days: number
  inactive_template_retention_days: number
  timezone: string
  updated_at: string
  updated_by: string | null
}

export interface SystemStatus {
  database: { state: 'ok' | 'error'; vendor?: string; error?: string }
  recognition: RecognitionReadiness
  worker: WorkerStatus
  server_time: string
  timezone: string
  debug: boolean
  versions: Record<string, string>
  last_successful_backup: string | null
}

export interface BackupRecord {
  id: number
  started_at: string
  finished_at: string | null
  status: 'success' | 'failed'
  file_name: string
  size_bytes: number
  message: string
  triggered_by: string
}

export interface StaffUser {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  role: 'admin' | 'operator'
  is_active: boolean
  last_login: string | null
  date_joined: string
  is_locked: boolean
}

export interface MySummary {
  date: string
  employee: EmployeeRef & { position: string; status: EmployeeStatus }
  today: AttendanceEvent | null
  month_days_present: number
  pending_corrections: number
  recent: AttendanceEvent[]
  enrollment: EnrollmentSummary
  privacy_notice: string
  alternative_method: string
  policy: Policy
}
