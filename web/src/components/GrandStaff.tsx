// A grand staff whose chords grow with the level: level n = up to n notes per hand (README "Max notes per hand").
const GAP = 10 // distance between staff lines
const TREBLE_BOTTOM = 70
const BASS_BOTTOM = 150
const STAFF_LEFT = 24
const STAFF_RIGHT = 316

function staffLines(bottom: number) {
  return [0, 1, 2, 3, 4].map((i) => (
    <line key={i} x1={STAFF_LEFT} x2={STAFF_RIGHT} y1={bottom - i * GAP} y2={bottom - i * GAP} />
  ))
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

export function GrandStaff({ level }: { level: number }) {
  // One bar with four beats; the chord on each beat varies a little so it reads as music, never exceeding `level`.
  const beats = [level, Math.max(1, level - 1), level, Math.max(1, level - 2)]
  return (
    <svg className="grand-staff" viewBox="0 0 340 180" role="img" aria-label={`Example bar at level ${level}: up to ${level} ${level === 1 ? 'note' : 'notes'} per hand`}>
      <g className="lines">
        {staffLines(TREBLE_BOTTOM)}
        {staffLines(BASS_BOTTOM)}
        <line x1={STAFF_LEFT} x2={STAFF_LEFT} y1={TREBLE_BOTTOM - 4 * GAP} y2={BASS_BOTTOM} />
        <line x1={STAFF_RIGHT} x2={STAFF_RIGHT} y1={TREBLE_BOTTOM - 4 * GAP} y2={BASS_BOTTOM} />
      </g>
      <text className="clef" x={30} y={TREBLE_BOTTOM + 2}>{'\u{1D11E}'}</text>
      <text className="clef clef-bass" x={30} y={BASS_BOTTOM - 5}>{'\u{1D122}'}</text>
      <g key={level}>
        {beats.map((count, i) => (
          <g key={i}>
            <Chord x={110 + i * 56} bottom={TREBLE_BOTTOM} count={count} melody />
            <Chord x={110 + i * 56} bottom={BASS_BOTTOM} count={count} />
          </g>
        ))}
      </g>
    </svg>
  )
}
