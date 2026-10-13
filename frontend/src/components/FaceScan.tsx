import clsx from 'clsx'
import { BadgeCheck, ScanFace } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

/*
 * Illustrative face-recognition viewport: line-art face, landmark points, a
 * Delaunay mesh revealed by a sweeping scan line, then a "match" result.
 * The people shown are fictional demo identities.
 */

type Pt = [number, number]

// Facial landmarks in a 400x440 space (symmetric about x=200) and their Delaunay edges.
const LANDMARKS: Pt[] = [[200,118],[200,186],[200,212],[200,238],[200,262],[200,276],[200,300],[200,311],[200,324],[200,350],[200,384],[150,138],[172,124],[128,180],[126,214],[129,250],[136,286],[148,320],[165,350],[183,372],[150,250],[166,282],[176,240],[144,184],[158,176],[174,176],[188,182],[150,208],[162,201],[176,202],[186,210],[175,216],[161,216],[188,250],[184,266],[191,276],[170,312],[184,302],[184,322],[250,138],[228,124],[272,180],[274,214],[271,250],[264,286],[252,320],[235,350],[217,372],[250,250],[234,282],[224,240],[256,184],[242,176],[226,176],[212,182],[250,208],[238,201],[224,202],[214,210],[225,216],[239,216],[212,250],[216,266],[209,276],[230,312],[216,302],[216,322]]
const EDGES: [number, number][] = [[0,12],[0,25],[0,26],[0,40],[0,53],[0,54],[1,2],[1,26],[1,30],[1,54],[1,58],[2,3],[2,30],[2,58],[3,4],[3,22],[3,30],[3,31],[3,33],[3,50],[3,58],[3,59],[3,61],[4,5],[4,33],[4,34],[4,35],[4,61],[4,62],[4,63],[5,6],[5,35],[5,63],[6,7],[6,35],[6,37],[6,63],[6,65],[7,8],[7,37],[7,38],[7,65],[7,66],[8,9],[8,38],[8,66],[9,10],[9,18],[9,19],[9,38],[9,46],[9,47],[9,66],[10,19],[10,47],[11,12],[11,13],[11,24],[11,25],[12,25],[13,14],[13,23],[13,24],[14,15],[14,20],[14,23],[14,27],[15,16],[15,20],[16,17],[16,20],[16,21],[16,36],[17,18],[17,36],[18,19],[18,36],[18,38],[20,21],[20,22],[20,27],[20,32],[20,34],[21,34],[21,35],[21,36],[21,37],[22,31],[22,32],[22,33],[22,34],[23,24],[23,27],[23,28],[24,25],[24,28],[25,26],[25,28],[25,29],[26,29],[26,30],[26,54],[27,28],[27,32],[28,29],[28,31],[28,32],[29,30],[29,31],[30,31],[31,32],[33,34],[34,35],[35,37],[36,37],[36,38],[37,38],[39,40],[39,41],[39,52],[39,53],[40,53],[41,42],[41,51],[41,52],[42,43],[42,48],[42,51],[42,55],[43,44],[43,48],[44,45],[44,48],[44,49],[44,64],[45,46],[45,64],[46,47],[46,64],[46,66],[48,49],[48,50],[48,55],[48,60],[48,62],[49,62],[49,63],[49,64],[49,65],[50,59],[50,60],[50,61],[50,62],[51,52],[51,55],[51,56],[52,53],[52,56],[53,54],[53,56],[53,57],[54,57],[54,58],[55,56],[55,60],[56,57],[56,59],[56,60],[57,58],[57,59],[58,59],[59,60],[61,62],[62,63],[63,65],[64,65],[64,66],[65,66]]

const mirror = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [400 - x, y])

/** Smooth path through points (Catmull-Rom converted to cubic Béziers). */
function smooth(pts: Pt[], closed = false): string {
  const p = closed ? [pts[pts.length - 1]!, ...pts, pts[0]!, pts[1]!] : [pts[0]!, ...pts, pts[pts.length - 1]!]
  let d = `M${p[1]![0]},${p[1]![1]}`
  for (let i = 1; i < p.length - 2; i++) {
    const [x0, y0] = p[i - 1]!
    const [x1, y1] = p[i]!
    const [x2, y2] = p[i + 1]!
    const [x3, y3] = p[i + 2]!
    d += ` C${x1 + (x2 - x0) / 6},${y1 + (y2 - y0) / 6} ${x2 - (x3 - x1) / 6},${y2 - (y3 - y1) / 6} ${x2},${y2}`
  }
  return closed ? `${d}Z` : d
}

const jawLeft: Pt[] = [[128, 180], [126, 214], [129, 250], [136, 286], [148, 320], [165, 350], [183, 372]]
const FACE = smooth([...jawLeft, [200, 386], ...mirror(jawLeft).reverse()])
const eyeLeft: Pt[] = [[149, 209], [162, 201], [176, 202], [187, 210], [175, 216], [161, 216]]
const EYES = [smooth(eyeLeft, true), smooth(mirror(eyeLeft), true)]
const browLeft: Pt[] = [[142, 186], [158, 176], [174, 175], [189, 181]]
const BROWS = [smooth(browLeft), smooth(mirror(browLeft))]
const EARS = ['M127,204 C111,198 106,220 111,240 C114,254 121,260 130,258', 'M273,204 C289,198 294,220 289,240 C286,254 279,260 270,258']
const NOSE = 'M195,214 C193,236 185,252 185,263 C187,272 195,277 200,277 C205,277 213,272 215,263'
const LIPS = [
  'M170,312 C181,304 192,300 200,305 C208,300 219,304 230,312',
  'M171,312 C186,315 214,315 229,312',
  'M171,312 C184,327 216,327 229,312',
]
const BODY = ['M174,368 L171,408 C150,420 108,428 70,452', 'M226,368 L229,408 C250,420 292,428 330,452']

const HAIR = [
  'M126,206 C110,128 150,84 202,83 C256,84 293,128 274,206 C272,170 262,146 246,133 C220,150 170,148 152,133 C138,148 129,172 126,206Z',
  'M124,214 C102,120 150,74 204,77 C263,80 302,128 279,226 C277,254 287,292 294,326 L277,322 C271,262 273,192 258,148 C230,130 184,126 154,140 C139,172 134,232 133,304 L114,308 C122,270 124,240 124,214Z',
  'M119,214 C90,168 104,90 160,74 C186,58 230,60 254,76 C302,96 314,170 281,214 C280,180 270,150 250,136 C222,124 178,124 150,136 C130,152 122,180 119,214Z',
]

const PEOPLE = [
  { name: 'Amina Uwase', team: 'Engineering', score: 0.97, time: '08:02', hair: 0, width: 1 },
  { name: 'Grace Mutoni', team: 'Operations', score: 0.94, time: '08:05', hair: 1, width: 0.95 },
  { name: 'Jean-Paul Habimana', team: 'Finance', score: 0.96, time: '08:09', hair: 2, width: 1.05 },
]

const SCAN_MS = 2600
const MATCH_MS = 2800

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('')
}

export function FaceScan({ className, compact = false }: { className?: string; compact?: boolean }) {
  const [index, setIndex] = useState(0)
  const [matched, setMatched] = useState(false)
  const bandRef = useRef<SVGGElement>(null)
  const person = PEOPLE[index]!

  // Phase timer: scan -> match -> next person.
  useEffect(() => {
    const t = window.setTimeout(
      () => {
        if (matched) setIndex((i) => (i + 1) % PEOPLE.length)
        setMatched((m) => !m)
      },
      matched ? MATCH_MS : SCAN_MS,
    )
    return () => window.clearTimeout(t)
  }, [matched])

  // Sweep the scan band with rAF (SVG transforms inside masks aren't reliably CSS-animatable).
  useEffect(() => {
    if (matched || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = ((now - start) % SCAN_MS) / SCAN_MS
      const eased = 0.5 - Math.cos(t * Math.PI * 2) / 2 // down and back up once per scan
      bandRef.current?.setAttribute('transform', `translate(0 ${40 + eased * 360})`)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [matched, index])

  const pts = useMemo(
    () => LANDMARKS.map(([x, y]): Pt => [200 + (x - 200) * person.width, y]),
    [person.width],
  )
  const faceTransform = `translate(${200 - 200 * person.width} 0) scale(${person.width} 1)`
  const accent = matched ? '#2af5a0' : '#19e3f0'

  return (
    <div
      className={clsx(
        'on-dark relative isolate aspect-[400/440] w-full overflow-hidden rounded-2xl bg-ink-950 text-white shadow-2xl ring-1 ring-white/10',
        className,
      )}
      role="img"
      aria-label="Animated illustration of SmartFace detecting facial landmarks and matching an enrolled employee"
    >
      <svg viewBox="0 0 400 440" className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <radialGradient id="fs-glow" cx="50%" cy="45%" r="60%">
            <stop offset="0" stopColor="#0f3b4a" />
            <stop offset="1" stopColor="#03121f" />
          </radialGradient>
          <linearGradient id="fs-bracket" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#19e3f0" />
            <stop offset="1" stopColor="#2af5a0" />
          </linearGradient>
          <linearGradient id="fs-band" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#19e3f0" stopOpacity="0" />
            <stop offset="0.85" stopColor="#19e3f0" stopOpacity="0.28" />
            <stop offset="1" stopColor="#19e3f0" stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id="fs-skin" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.1" />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.03" />
            <stop offset="1" stopColor="#19e3f0" stopOpacity="0.08" />
          </linearGradient>
          <mask id="fs-band-mask">
            <g ref={bandRef} transform="translate(0 40)">
              <rect x="0" y="-70" width="400" height="80" fill="url(#fs-band)" />
            </g>
          </mask>
          <pattern id="fs-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0H0V20" fill="none" stroke="#19e3f0" strokeOpacity="0.06" />
          </pattern>
        </defs>

        <rect width="400" height="440" fill="url(#fs-glow)" />
        <rect width="400" height="440" fill="url(#fs-grid)" />

        {/* Face line art */}
        <g transform={faceTransform} fill="none" stroke="#e6f6ff" strokeLinecap="round" strokeLinejoin="round">
          {BODY.map((d) => (
            <path key={d} d={d} strokeOpacity="0.35" strokeWidth="1.6" />
          ))}
          <path d={FACE} fill="url(#fs-skin)" strokeOpacity="0.6" strokeWidth="1.8" />
          <path key={person.hair} d={HAIR[person.hair]} fill="#e6f6ff" fillOpacity="0.1" strokeOpacity="0.5" strokeWidth="1.6" className="animate-page-in" />
          {EARS.map((d) => (
            <path key={d} d={d} strokeOpacity="0.45" strokeWidth="1.6" />
          ))}
          {BROWS.map((d) => (
            <path key={d} d={d} strokeOpacity="0.7" strokeWidth="3" />
          ))}
          {EYES.map((d) => (
            <path key={d} d={d} strokeOpacity="0.7" strokeWidth="1.6" />
          ))}
          <circle cx="168" cy="209" r="5" fill="#e6f6ff" fillOpacity="0.7" stroke="none" />
          <circle cx="232" cy="209" r="5" fill="#e6f6ff" fillOpacity="0.7" stroke="none" />
          <path d={NOSE} strokeOpacity="0.55" strokeWidth="1.6" />
          {LIPS.map((d) => (
            <path key={d} d={d} strokeOpacity="0.6" strokeWidth="1.6" />
          ))}
        </g>

        {/* Landmark mesh: faint everywhere, bright where the scan band passes, solid on match */}
        <g stroke={accent} strokeWidth="0.9" style={{ transition: 'stroke 0.5s' }}>
          <g strokeOpacity={matched ? 0.42 : 0.12} style={{ transition: 'stroke-opacity 0.6s' }}>
            {EDGES.map(([a, b]) => (
              <line key={`${a}-${b}`} x1={pts[a]![0]} y1={pts[a]![1]} x2={pts[b]![0]} y2={pts[b]![1]} />
            ))}
          </g>
          {!matched && (
            <g mask="url(#fs-band-mask)" strokeWidth="1.3">
              {EDGES.map(([a, b]) => (
                <line key={`${a}-${b}`} x1={pts[a]![0]} y1={pts[a]![1]} x2={pts[b]![0]} y2={pts[b]![1]} />
              ))}
            </g>
          )}
        </g>
        <g fill={accent} style={{ transition: 'fill 0.5s' }}>
          {pts.map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={matched ? 2.4 : 2}
              className={matched ? undefined : 'animate-blink'}
              style={{ animationDelay: `${(i * 97) % 1600}ms` }}
            />
          ))}
        </g>

        {/* Scan line */}
        {!matched && (
          <g mask="url(#fs-band-mask)">
            <rect width="400" height="440" fill="#19e3f0" fillOpacity="0.07" />
          </g>
        )}

        {/* Lock-on brackets */}
        <g
          fill="none"
          stroke="url(#fs-bracket)"
          strokeWidth="5"
          strokeLinecap="round"
          style={{
            transformOrigin: '200px 240px',
            transform: matched ? 'scale(0.92)' : 'scale(1)',
            transition: 'transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
        >
          <path d="M92,120 V92 Q92,72 112,72 H140" />
          <path d="M260,72 H288 Q308,72 308,92 V120" />
          <path d="M308,360 V388 Q308,408 288,408 H260" />
          <path d="M140,408 H112 Q92,408 92,388 V360" />
        </g>
      </svg>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3 text-[10px] font-medium tracking-wider text-white/70 uppercase sm:p-4 sm:text-[11px]">
        <span className="flex items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-1 backdrop-blur">
          <span className="relative flex size-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-red-500" />
            <span className="relative size-1.5 rounded-full bg-red-500" />
          </span>
          Live · Entrance
        </span>
        {!compact && <span className="rounded-full bg-black/30 px-2.5 py-1 backdrop-blur">On-device AI</span>}
      </div>

      <div className="absolute inset-x-3 bottom-3 sm:inset-x-4 sm:bottom-4">
        <div
          className={clsx(
            'flex items-center gap-3 rounded-xl border px-3 py-2.5 backdrop-blur-md transition-colors duration-500',
            matched ? 'border-[#2af5a0]/40 bg-[#04241f]/80' : 'border-white/10 bg-ink-900/75',
          )}
        >
          {matched ? (
            <span key={`a${index}`} className="flex size-9 shrink-0 animate-page-in items-center justify-center rounded-full bg-linear-to-br from-[#19e3f0] to-[#2af5a0] text-xs font-bold text-ink-950">
              {initials(person.name)}
            </span>
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#19e3f0]">
              <ScanFace size={18} className="animate-pulse" />
            </span>
          )}
          <div className="min-w-0 flex-1" aria-live="off">
            {matched ? (
              <div key={`m${index}`} className="animate-page-in">
                <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                  {person.name}
                  <BadgeCheck size={15} className="shrink-0 text-[#2af5a0]" aria-hidden />
                </p>
                <p className="truncate text-xs text-white/60">
                  {person.team} · IN {person.time}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-white/90">Mapping landmarks…</p>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                  <div key={index} className="h-full rounded-full bg-linear-to-r from-[#19e3f0] to-[#2af5a0]" style={{ animation: `fill-bar ${SCAN_MS}ms linear both` }} />
                </div>
              </div>
            )}
          </div>
          {matched && (
            <span key={`s${index}`} className="tabular shrink-0 animate-page-in rounded-md bg-[#2af5a0]/15 px-2 py-1 text-xs font-semibold text-[#2af5a0]">
              {Math.round(person.score * 100)}%
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
