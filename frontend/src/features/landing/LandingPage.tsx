import clsx from 'clsx'
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  ChevronDown,
  ClipboardCheck,
  FileBarChart,
  History,
  LockKeyhole,
  ScanFace,
  ServerCog,
  ShieldCheck,
  UserPlus,
  Zap,
} from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router'

import { FaceScan } from '../../components/FaceScan'
import { Logo } from '../../components/Logo'
import { ThemeToggle } from '../../components/ThemeToggle'
import { ButtonLink } from '../../components/ui/Button'
import { useDocumentTitle } from '../../hooks/useApi'
import { useReveal } from '../../hooks/useReveal'
import { homeFor, useAuth } from '../auth/AuthContext'

const steps = [
  { icon: UserPlus, title: 'Enroll', text: 'Consent first, then a few guided captures.' },
  { icon: ScanFace, title: 'Detect', text: 'The entrance camera finds clear faces.' },
  { icon: LockKeyhole, title: 'Match locally', text: 'Encrypted templates, on your server.' },
  { icon: BadgeCheck, title: 'Record', text: 'One IN per day. Unsure? A person reviews.' },
]

const faqs = [
  { q: 'Does face data leave our network?', a: 'No. Detection and matching run on your own server with local models. No cloud recognition APIs, and it keeps working offline.' },
  { q: 'Are photos stored?', a: 'Not by default. Frames are processed in memory and discarded; only an encrypted template is kept, and it can be revoked at any time.' },
  { q: 'What if it isn’t sure who someone is?', a: 'It abstains. Uncertain faces are never assigned automatically — they wait for a person to review.' },
  { q: 'Can employees see their own records?', a: 'Yes. Employees have a portal to view their attendance and request corrections, with every change audited.' },
]

const arrivals = [
  { name: 'Amina Uwase', time: '08:02', score: 97 },
  { name: 'Eric Nshuti', time: '08:03', score: 95 },
  { name: 'Grace Mutoni', time: '08:05', score: 94 },
  { name: 'Diane Ingabire', time: '08:07', score: 98 },
  { name: 'Jean-Paul H.', time: '08:09', score: 96 },
  { name: 'Patrick Mugisha', time: '08:11', score: 93 },
]

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold tracking-wide text-brand-800">
      {children}
    </p>
  )
}

function SectionTitle({ eyebrow, title, className }: { eyebrow: string; title: ReactNode; className?: string }) {
  return (
    <div className={clsx('reveal mx-auto max-w-2xl text-center', className)}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance text-slate-900 sm:text-4xl">{title}</h2>
    </div>
  )
}

/** Live arrivals list that keeps ticking new entries in. */
function ArrivalsTicker() {
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setOffset((o) => (o + 1) % arrivals.length), 2200)
    return () => window.clearInterval(t)
  }, [])
  const rows = Array.from({ length: 4 }, (_, i) => arrivals[(offset + arrivals.length - i) % arrivals.length]!)
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li
          key={`${r.name}-${offset - i}`}
          className={clsx(
            'flex items-center gap-3 rounded-lg border border-slate-200 bg-surface px-3 py-2',
            i === 0 && 'animate-page-in border-brand-200 bg-brand-50',
          )}
          style={{ opacity: 1 - i * 0.18 }}
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-linear-to-br from-cyan-400 to-emerald-400 text-[10px] font-bold text-ink-950">
            {r.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{r.name}</span>
          <span className="tabular text-xs text-slate-500">IN {r.time}</span>
          <span className="tabular rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">{r.score}%</span>
        </li>
      ))}
    </ul>
  )
}

function Tile({ className, icon: Icon, title, text, children, delay = 0 }: {
  className?: string
  icon: typeof Zap
  title: string
  text: string
  children?: ReactNode
  delay?: number
}) {
  return (
    <div
      className={clsx(
        'reveal group relative overflow-hidden rounded-2xl border border-slate-200 bg-surface p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-xl hover:shadow-brand-500/10',
        className,
      )}
      style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}
    >
      <div className="pointer-events-none absolute -top-24 -right-24 size-48 rounded-full bg-brand-400/0 blur-3xl transition-colors duration-500 group-hover:bg-brand-400/20" />
      <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-200 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
        <Icon size={20} aria-hidden />
      </span>
      <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{text}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  )
}

/** Face-scan viewport that tilts gently toward the pointer. */
function HeroVisual() {
  const ref = useRef<HTMLDivElement>(null)
  const onMove = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el || e.pointerType !== 'mouse') return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--rx', `${((e.clientY - r.top) / r.height - 0.5) * -8}deg`)
    el.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 10}deg`)
  }
  const reset = () => {
    ref.current?.style.setProperty('--rx', '0deg')
    ref.current?.style.setProperty('--ry', '0deg')
  }
  return (
    <div className="relative mx-auto w-full max-w-md perspective-[1200px] lg:max-w-none" onPointerMove={onMove} onPointerLeave={reset}>
      <div className="absolute -inset-6 rounded-[2rem] bg-linear-to-br from-cyan-400/30 via-transparent to-emerald-400/30 blur-2xl" aria-hidden />
      <div
        ref={ref}
        className="relative transition-transform duration-300 ease-out [transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))]"
      >
        <FaceScan />
      </div>
      <div className="glass absolute top-16 -left-4 hidden animate-float items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 shadow-lg sm:flex lg:-left-10">
        <LockKeyhole size={14} className="text-brand-600" aria-hidden />
        Template encrypted
      </div>
      <div
        className="glass absolute -right-3 bottom-28 hidden animate-float items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 shadow-lg sm:flex lg:-right-8"
        style={{ animationDelay: '-3.5s' }}
      >
        <ServerCog size={14} className="text-brand-600" aria-hidden />
        0 cloud calls
      </div>
    </div>
  )
}

export function LandingPage() {
  useDocumentTitle('')
  useReveal()
  const { user } = useAuth()
  const cta = user ? { to: homeFor(user.role), label: 'Open dashboard' } : { to: '/login', label: 'Sign in' }
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-dvh overflow-x-clip bg-canvas">
      <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-6">
        <div
          className={clsx(
            'mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 rounded-2xl px-3 transition-all duration-300 sm:px-4',
            scrolled ? 'glass shadow-lg shadow-slate-900/5' : 'border border-transparent',
          )}
        >
          <Link to="/" aria-label="SmartFace home">
            <Logo />
          </Link>
          <nav aria-label="Sections" className="hidden items-center gap-1 text-sm font-medium text-slate-600 md:flex">
            {[
              ['#how-it-works', 'How it works'],
              ['#features', 'Features'],
              ['#privacy', 'Privacy'],
              ['#faq', 'FAQ'],
            ].map(([href, label]) => (
              <a key={href} href={href} className="rounded-full px-3 py-1.5 transition-colors hover:bg-slate-100 hover:text-slate-900">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <ButtonLink to={cta.to} size="sm" className="rounded-full px-4">
              {cta.label}
            </ButtonLink>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative isolate overflow-hidden px-4 pt-28 pb-20 sm:px-6 sm:pt-36 lg:pb-28">
          <div className="bg-grid absolute inset-0 -z-10 mask-[radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" aria-hidden />
          <div className="absolute -top-40 left-1/2 -z-10 size-[42rem] -translate-x-1/2 rounded-full bg-linear-to-tr from-cyan-400/25 to-emerald-300/25 blur-3xl dark:from-cyan-500/15 dark:to-emerald-500/10" aria-hidden />

          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
            <div className="text-center lg:text-left">
              <div className="animate-page-in">
                <Eyebrow>
                  <span className="relative flex size-2">
                    <span className="absolute inset-0 animate-ping rounded-full bg-brand-400" />
                    <span className="relative size-2 rounded-full bg-brand-500" />
                  </span>
                  Runs 100% on your network
                </Eyebrow>
              </div>
              <h1
                className="mt-6 animate-page-in text-[2.6rem] leading-[1.05] font-semibold tracking-tight text-balance text-slate-900 sm:text-6xl lg:text-7xl"
                style={{ animationDelay: '80ms' }}
              >
                Attendance that <span className="text-gradient animate-gradient">knows your face.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-lg animate-page-in text-lg text-slate-600 lg:mx-0" style={{ animationDelay: '160ms' }}>
                Walk in. You're recorded. Private, local and fully auditable.
              </p>
              <div
                className="mt-9 flex animate-page-in flex-col justify-center gap-3 sm:flex-row lg:justify-start"
                style={{ animationDelay: '240ms' }}
              >
                <ButtonLink to={cta.to} className="group h-12 rounded-full px-6 text-base shadow-lg shadow-brand-500/25">
                  {cta.label}
                  <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" aria-hidden />
                </ButtonLink>
                <a
                  href="#how-it-works"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-slate-300 bg-surface/60 px-6 text-base font-medium text-slate-700 backdrop-blur transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  See how it works
                </a>
              </div>
              <dl className="mx-auto mt-12 grid max-w-md animate-page-in grid-cols-3 gap-4 lg:mx-0" style={{ animationDelay: '320ms' }}>
                {[
                  ['0', 'cloud services'],
                  ['0', 'photos stored'],
                  ['100%', 'audited'],
                ].map(([value, label]) => (
                  <div key={label}>
                    <dt className="sr-only">{label}</dt>
                    <dd className="tabular text-2xl font-semibold text-slate-900 sm:text-3xl">{value}</dd>
                    <dd className="text-xs text-slate-500">{label}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="animate-page-in" style={{ animationDelay: '200ms' }}>
              <HeroVisual />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-24">
          <SectionTitle eyebrow="How it works" title="From face to record in four steps" />
          <ol className="relative mx-auto mt-14 grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            <div
              className="animate-gradient absolute top-7 right-[12%] left-[12%] hidden h-px bg-[linear-gradient(90deg,transparent,#19e3f0,#2af5a0,transparent)] bg-[length:200%_auto] lg:block"
              aria-hidden
            />
            {steps.map((s, i) => (
              <li key={s.title} className="reveal relative text-center" style={{ '--reveal-delay': `${i * 110}ms` } as CSSProperties}>
                <span className="relative mx-auto flex size-14 items-center justify-center rounded-2xl border border-slate-200 bg-surface text-brand-700 shadow-lg shadow-brand-500/10">
                  <s.icon size={24} aria-hidden />
                  <span className="tabular absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-fg">
                    {i + 1}
                  </span>
                </span>
                <h3 className="mt-5 text-base font-semibold text-slate-900">{s.title}</h3>
                <p className="mx-auto mt-1 max-w-[16rem] text-sm text-slate-500">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Features bento */}
        <section id="features" className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-24">
          <SectionTitle eyebrow="Features" title="Everything the front desk needs" />
          <div className="mx-auto mt-14 grid max-w-6xl gap-4 md:grid-cols-3">
            <Tile className="md:col-span-2 md:row-span-2" icon={Zap} title="Live arrivals" text="Recognised at the door, recorded instantly.">
              <ArrivalsTicker />
            </Tile>
            <Tile icon={ClipboardCheck} title="Human review" text="Uncertain matches wait for a person." delay={80} />
            <Tile icon={History} title="Full audit trail" text="Every correction, who and why." delay={160} />
            <Tile icon={FileBarChart} title="Reports & CSV" text="Daily and monthly, filtered your way." delay={80} />
            <Tile icon={Camera} title="Camera health" text="Real frames, honest status." delay={160}>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <span className="relative flex size-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500" />
                  <span className="relative size-2 rounded-full bg-emerald-500" />
                </span>
                Entrance · online
              </div>
            </Tile>
            <Tile icon={ShieldCheck} title="Role-based access" text="Admins, operators, employees." delay={240} />
          </div>
        </section>

        {/* Privacy band (always dark, like the logo) */}
        <section id="privacy" className="scroll-mt-24 px-4 py-12 sm:px-6">
          <div className="on-dark reveal relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-ink-950 px-6 py-14 text-white sm:px-12">
            <div className="bg-grid absolute inset-0 opacity-60 mask-[radial-gradient(ellipse_at_right,black,transparent_70%)]" aria-hidden />
            <div className="absolute -right-32 -bottom-32 size-96 rounded-full bg-linear-to-tr from-cyan-500/30 to-emerald-400/20 blur-3xl" aria-hidden />
            <div className="relative grid items-center gap-10 md:grid-cols-[1fr_auto]">
              <div>
                <p className="text-sm font-semibold text-[#2af5a0]">Privacy by design</p>
                <h2 className="mt-3 max-w-lg text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                  Your faces. Your server. <span className="text-gradient">Nobody else.</span>
                </h2>
                <ul className="mt-8 grid gap-3 text-sm text-white/80 sm:grid-cols-3">
                  {['No photos stored', 'Encrypted templates', 'Works offline'].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <BadgeCheck size={18} className="shrink-0 text-[#2af5a0]" aria-hidden />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative mx-auto size-40 sm:size-48">
                <span className="absolute inset-0 animate-pulse-ring rounded-[2rem] border border-[#2af5a0]/50" aria-hidden />
                <span className="absolute inset-0 animate-pulse-ring rounded-[2rem] border border-[#19e3f0]/40 [animation-delay:1.2s]" aria-hidden />
                <img src="/brand/logo-512.webp" alt="SmartFace logo" width={192} height={192} className="relative size-full animate-float rounded-[2rem] shadow-2xl shadow-cyan-500/20 ring-1 ring-white/10" />
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-24">
          <SectionTitle eyebrow="FAQ" title="Good questions" />
          <div className="mx-auto mt-12 max-w-3xl space-y-3">
            {faqs.map((f, i) => (
              <details
                key={f.q}
                className="reveal group rounded-2xl border border-slate-200 bg-surface px-5 py-4 transition-colors open:border-brand-300 sm:px-6"
                style={{ '--reveal-delay': `${i * 70}ms` } as CSSProperties}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-all group-open:rotate-180 group-open:bg-brand-50 group-open:text-brand-700">
                    <ChevronDown size={16} aria-hidden />
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 pb-24 sm:px-6">
          <div className="reveal mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Ready when you walk in.</h2>
            <div className="mt-8 flex justify-center">
              <ButtonLink to={cta.to} className="group h-12 rounded-full px-7 text-base shadow-lg shadow-brand-500/25">
                {cta.label}
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" aria-hidden />
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-slate-500 sm:flex-row">
          <Logo />
          <p>© {new Date().getFullYear()} SmartFace · On-premises attendance</p>
          <Link to="/login" className="font-medium hover:text-slate-900">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  )
}
