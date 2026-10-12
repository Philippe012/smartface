import {
  ArrowRight,
  BadgeCheck,
  Camera,
  ChevronDown,
  ClipboardCheck,
  Database,
  FileBarChart,
  Fingerprint,
  History,
  LockKeyhole,
  Network,
  ScanFace,
  ServerCog,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react'
import { Link } from 'react-router'

import { Logo } from '../../components/Logo'
import { ButtonLink } from '../../components/ui/Button'
import { useDocumentTitle } from '../../hooks/useApi'
import { useAuth, homeFor } from '../auth/AuthContext'

const features = [
  {
    icon: ScanFace,
    title: 'Automatic IN recording',
    text: 'An entrance camera recognises enrolled employees and records their arrival. Repeated sightings are merged, never turned into extra records.',
  },
  {
    icon: UserCheck,
    title: 'Guided enrollment',
    text: 'Administrators capture several quality-checked views of each employee after notice and consent are documented. Poor samples are rejected with clear guidance.',
  },
  {
    icon: ClipboardCheck,
    title: 'Human review for uncertain matches',
    text: 'When a face is unclear or ambiguous, SmartFace abstains and queues the observation for a person to confirm or dismiss.',
  },
  {
    icon: History,
    title: 'Corrections with a full audit trail',
    text: 'Every correction keeps who made it, when, why and the before/after values. Employees can request corrections from their own portal.',
  },
  {
    icon: FileBarChart,
    title: 'Daily and monthly reports',
    text: 'Filter attendance by date, employee and camera, and export permitted reports to CSV. Lateness is only calculated once your policy is configured.',
  },
  {
    icon: Camera,
    title: 'Honest camera health',
    text: 'Camera status comes from real frames received by the recognition service. A disconnected camera is shown as disconnected.',
  },
]

const steps = [
  { title: 'Enroll', text: 'Create the employee record, record notice and consent, then capture guided face samples.' },
  { title: 'Detect', text: 'The recognition service samples frames from the local entrance camera and checks image quality.' },
  { title: 'Match locally', text: 'Encrypted templates are compared on your server against active employees using validated thresholds.' },
  { title: 'Record or review', text: 'Confident matches create one IN record per day. Everything else is held for human review.' },
]

const faqs = [
  {
    q: 'Does SmartFace send face data to the cloud?',
    a: 'No. Detection and matching run on your own server using locally installed open models. No paid cloud AI or external face-recognition API is used, and core functions keep working without internet access.',
  },
  {
    q: 'Are photos of employees stored?',
    a: 'Not by default. Camera frames and enrollment images are processed in memory and discarded. Only an encrypted numerical template is kept, and it can be revoked and deleted at any time.',
  },
  {
    q: 'What happens if the system is not sure who someone is?',
    a: 'It abstains. Uncertain and unknown observations are never assigned to an employee automatically; an administrator reviews them. A manual attendance method is always available.',
  },
  {
    q: 'Does it record when people leave?',
    a: 'The first release records arrivals (IN) from one entrance camera. Departures will use a dedicated exit camera in a later release; leaving is never inferred from a second sighting.',
  },
  {
    q: 'Can attendance data be used to make decisions about employees automatically?',
    a: 'It should not be. Recognition confidence is a system signal, not proof of identity. Records can be reviewed and corrected, and consequential decisions should always involve people.',
  },
  {
    q: 'What do we need before going live?',
    a: 'A compatible local IP camera, a server on your network, an approved attendance policy, and a privacy and employment review covering lawful basis, notices, retention and alternatives for employees.',
  },
]

function Section({ id, eyebrow, title, intro, children }: { id: string; eyebrow: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-brand-700">{eyebrow}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
          {intro && <p className="mt-3 text-base text-slate-600">{intro}</p>}
        </div>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  )
}

export function LandingPage() {
  useDocumentTitle('')
  const { user } = useAuth()
  const cta = user ? { to: homeFor(user.role), label: 'Open dashboard' } : { to: '/login', label: 'Sign in' }

  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" aria-label="SmartFace home">
            <Logo />
          </Link>
          <nav aria-label="Sections" className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-900">Features</a>
            <a href="#how-it-works" className="hover:text-slate-900">How it works</a>
            <a href="#security" className="hover:text-slate-900">Security</a>
            <a href="#faq" className="hover:text-slate-900">FAQ</a>
          </nav>
          <ButtonLink to={cta.to} size="sm">
            {cta.label}
          </ButtonLink>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-ink-900 px-4 pt-16 pb-20 text-white sm:px-6 sm:pt-24 sm:pb-28">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
              backgroundSize: '44px 44px',
            }}
            aria-hidden
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-brand-200">
                <Network size={14} aria-hidden />
                Runs entirely on your local network
              </p>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Workplace attendance that records itself, without leaving your building.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-slate-300">
                SmartFace recognises enrolled employees at the entrance camera, records arrival times and keeps
                people in control with review, correction and a complete audit trail.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink to={cta.to} className="h-11 bg-brand-500 px-5 hover:bg-brand-400">
                  {cta.label}
                  <ArrowRight size={16} aria-hidden />
                </ButtonLink>
                <a
                  href="#how-it-works"
                  className="inline-flex h-11 items-center justify-center rounded-md border border-white/20 px-5 text-sm font-medium text-white hover:bg-white/10"
                >
                  See how it works
                </a>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 sm:p-6" aria-label="Processing pipeline">
              <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">On-premises pipeline</p>
              <ol className="mt-5 space-y-3">
                {[
                  { icon: Camera, label: 'IP camera', sub: 'RTSP stream on the local network' },
                  { icon: ScanFace, label: 'Detection & quality check', sub: 'Blurry or partial faces are skipped' },
                  { icon: Fingerprint, label: 'Local template matching', sub: 'Encrypted templates, active employees only' },
                  { icon: BadgeCheck, label: 'Attendance rules', sub: 'One IN per day; uncertain goes to review' },
                  { icon: Database, label: 'PostgreSQL & dashboard', sub: 'Reports, corrections, audit log' },
                ].map((step, i) => (
                  <li key={step.label} className="flex items-center gap-4 rounded-lg border border-white/10 bg-ink-950/40 px-4 py-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white/10 text-brand-200">
                      <step.icon size={18} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">
                        <span className="tabular mr-1.5 text-slate-500">{i + 1}.</span>
                        {step.label}
                      </p>
                      <p className="text-xs text-slate-400">{step.sub}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <Section
          id="features"
          eyebrow="Features"
          title="Everything an attendance office needs, and nothing it doesn't"
          intro="Built for administrators who need dependable records and employees who deserve transparency."
        >
          <div className="grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="bg-white p-6">
                <f.icon size={20} className="text-brand-700" aria-hidden />
                <h3 className="mt-4 text-base font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.text}</p>
              </div>
            ))}
          </div>
        </Section>

        <div className="border-y border-slate-200 bg-slate-50">
          <Section
            id="how-it-works"
            eyebrow="How it works"
            title="From enrollment to a reviewed attendance record"
            intro="Enrollment adds a protected template for each employee. The recognition model itself is never retrained."
          >
            <ol className="grid gap-6 md:grid-cols-4">
              {steps.map((s, i) => (
                <li key={s.title} className="relative">
                  <span className="tabular flex size-9 items-center justify-center rounded-full bg-ink-900 text-sm font-semibold text-white">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.text}</p>
                </li>
              ))}
            </ol>
          </Section>
        </div>

        <Section
          id="security"
          eyebrow="Security & privacy"
          title="Biometric data handled with the care it requires"
          intro="Facial templates are sensitive. SmartFace is designed to collect the minimum, keep it local and make every privileged action traceable."
        >
          <div className="grid gap-8 lg:grid-cols-2">
            <ul className="space-y-5">
              {[
                { icon: ServerCog, title: 'Local deployment', text: 'API, database and recognition service run on a server you control. No external recognition services.' },
                { icon: LockKeyhole, title: 'Encrypted templates', text: 'Face templates and camera passwords are encrypted at rest. Images are not stored by default.' },
                { icon: ShieldCheck, title: 'Role-based access', text: 'Administrators, operators and employees each see only what their role allows, enforced on the server.' },
                { icon: History, title: 'Audit log', text: 'Sign-ins, enrollment, corrections, exports and deletions are recorded in an append-only log.' },
              ].map((item) => (
                <li key={item.title} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
                    <item.icon size={19} aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{item.text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Users size={17} className="text-slate-500" aria-hidden />
                Responsible use
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li>Face recognition is probabilistic. A match score is a signal, not proof of identity.</li>
                <li>Uncertain observations are never assigned automatically. People review them.</li>
                <li>Employees can view their own records, request corrections and use a manual alternative.</li>
                <li>Complete a privacy and employment assessment for your jurisdiction before enrolling anyone.</li>
                <li>Do not use attendance records as the sole basis for consequential employment decisions.</li>
              </ul>
            </div>
          </div>
        </Section>

        <div className="border-t border-slate-200 bg-slate-50">
          <Section id="faq" eyebrow="FAQ" title="Common questions">
            <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
              {faqs.map((f) => (
                <details key={f.q} className="group px-5 py-4 sm:px-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <ChevronDown size={18} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">{f.a}</p>
                </details>
              ))}
            </div>
          </Section>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm text-sm text-slate-500">
              On-premises facial recognition attendance. Your data stays on your network.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
            <a href="#features" className="hover:text-slate-900">Features</a>
            <a href="#security" className="hover:text-slate-900">Security</a>
            <a href="#faq" className="hover:text-slate-900">FAQ</a>
            <Link to="/login" className="hover:text-slate-900">Sign in</Link>
          </nav>
        </div>
        <p className="mx-auto mt-8 max-w-6xl border-t border-slate-100 pt-6 text-xs text-slate-400">
          © {new Date().getFullYear()} SmartFace Attendance System.
        </p>
      </footer>
    </div>
  )
}
