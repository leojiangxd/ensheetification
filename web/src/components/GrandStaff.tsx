// A grand staff whose chords grow with the level: level n = up to n notes per hand (README "Max notes per hand").
const GAP = 10 // distance between staff lines
const TREBLE_BOTTOM = 70
const BASS_BOTTOM = 150
const STAFF_LEFT = 24
const FIRST_BAR = 292 // first bar is wider to fit the clefs
const BAR = 230
const BEAT = 56

// Chord sizes per beat; rotated per bar so a multi-bar score does not repeat itself.
function beatsFor(level: number, bar: number) {
  const pattern = [level, level - 1, level, level - 2, level - 1, level]
  return [0, 1, 2, 3].map((i) => Math.max(1, pattern[(bar + i) % pattern.length]))
}

// Stacked thirds from the bottom line up, stem up on the right; the top right-hand note is the melody.
function Chord({ x, bottom, count, melody = false }: { x: number; bottom: number; count: number; melody?: boolean }) {
  const ys = Array.from({ length: count }, (_, i) => bottom - i * GAP)
  const top = ys[ys.length - 1]
  return (
    <g className="chord">
      {ys.map((y, i) => (
        <ellipse key={i} className={melody && i === count - 1 ? 'notehead melody' : 'notehead'} cx={x} cy={y} rx={6.4} ry={4.4} transform={`rotate(-20 ${x} ${y})`} style={{ animationDelay: `${i * 40}ms` }} />
      ))}
      <line className="stem" x1={x + 5.8} x2={x + 5.8} y1={bottom - 1.5} y2={top - 32} />
    </g>
  )
}

type Props = { level: number; bars?: number; firstBar?: number; label?: string }

export function GrandStaff({ level, bars = 1, firstBar = 0, label }: Props) {
  const right = STAFF_LEFT + FIRST_BAR + (bars - 1) * BAR
  const barStarts = Array.from({ length: bars }, (_, b) => (b === 0 ? STAFF_LEFT : STAFF_LEFT + FIRST_BAR + (b - 1) * BAR))
  const top = TREBLE_BOTTOM - 4 * GAP
  return (
    <svg
      className="grand-staff"
      viewBox={`0 0 ${right + STAFF_LEFT} 180`}
      role="img"
      aria-label={label ?? `Example bar at level ${level}: up to ${level} ${level === 1 ? 'note' : 'notes'} per hand`}
    >
      <g className="lines">
        {[TREBLE_BOTTOM, BASS_BOTTOM].flatMap((bottom) =>
          [0, 1, 2, 3, 4].map((i) => <line key={`${bottom}-${i}`} x1={STAFF_LEFT} x2={right} y1={bottom - i * GAP} y2={bottom - i * GAP} />),
        )}
        {[...barStarts, right].map((x) => <line key={x} x1={x} x2={x} y1={top} y2={BASS_BOTTOM} />)}
      </g>
      <text className="clef" x={30} y={TREBLE_BOTTOM + 2}>{'\u{1D11E}'}</text>
      <text className="clef clef-bass" x={30} y={BASS_BOTTOM - 5}>{'\u{1D122}'}</text>
      <g key={level}>
        {barStarts.map((start, b) =>
          beatsFor(level, firstBar + b).map((count, i) => {
            const x = start + (b === 0 ? 86 : 30) + i * BEAT
            return (
              <g key={`${b}-${i}`}>
                <Chord x={x} bottom={TREBLE_BOTTOM} count={count} melody />
                <Chord x={x} bottom={BASS_BOTTOM} count={count} />
              </g>
            )
          }),
        )}
      </g>
    </svg>
  )
}
