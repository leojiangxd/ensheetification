import { useId, useState, useSyncExternalStore } from 'react'
import { Link, useParams } from 'react-router'
import { GrandStaff } from '../components/GrandStaff'
import { Header } from '../components/Header'
import { LEVELS } from '../content'
import { SAMPLE_UPLOADS, STATUS_LABEL, displayName, formatDate, formatDuration, type Upload } from '../uploads'

const TOTAL_BARS = 12
const NARROW = matchMedia('(max-width: 40rem)')

// Like a printed score reflowed for the screen: fewer bars per line on narrow screens.
function useBarsPerSystem() {
  const narrow = useSyncExternalStore(
    (onChange) => {
      NARROW.addEventListener('change', onChange)
      return () => NARROW.removeEventListener('change', onChange)
    },
    () => NARROW.matches,
  )
  return narrow ? 2 : 4
}

function Player({ upload }: { upload: Upload }) {
  const duration = upload.durationSec ?? 0
  const [position, setPosition] = useState(0)
  const id = useId()
  return (
    <div className="player">
      <button type="button" className="primary play" onClick={() => alert('Coming soon: this will play the arrangement and scroll the score along with it.')}>
        Play
      </button>
      <label htmlFor={`${id}-seek`} className="visually-hidden">Position</label>
      <input
        id={`${id}-seek`}
        className="seek"
        type="range"
        min={0}
        max={duration}
        value={position}
        onChange={(e) => setPosition(Number(e.target.value))}
        aria-valuetext={`${formatDuration(position)} of ${formatDuration(duration)}`}
      />
      <span className="time">
        {formatDuration(position)} / {formatDuration(duration)}
      </span>
    </div>
  )
}

function Body({ upload }: { upload: Upload }) {
  const name = displayName(upload)
  const perSystem = useBarsPerSystem()
  if (upload.status === 'arranging') {
    return <p className="notice">This song is still being arranged. Check back in a few minutes.</p>
  }
  if (upload.status === 'failed') {
    return (
      <div className="notice notice-failed">
        <p>Arranging this song failed.</p>
        <button type="button" className="secondary" onClick={() => alert(`Coming soon: this will try arranging ${name} again.`)}>Try again</button>
      </div>
    )
  }
  return (
    <>
      <Player upload={upload} />
      <div className="score" role="group" aria-label="Score">
        {Array.from({ length: TOTAL_BARS / perSystem }, (_, s) => (
          <GrandStaff
            key={s}
            level={upload.level}
            bars={perSystem}
            firstBar={s * perSystem}
            label={`Sample score, bars ${s * perSystem + 1} to ${(s + 1) * perSystem}`}
          />
        ))}
      </div>
    </>
  )
}

export function Song() {
  const { id } = useParams()
  const upload = SAMPLE_UPLOADS.find((u) => u.id === id)

  if (!upload) {
    return (
      <>
        <title>Song not found - ensheetification</title>
        <Header />
        <main className="song wrap">
          <Link to="/songs" className="back">Back to My songs</Link>
          <h1>Song not found</h1>
          <p className="notice">This song doesn't exist or was removed. Pick one from My songs.</p>
        </main>
      </>
    )
  }

  const name = displayName(upload)
  const level = LEVELS[upload.level - 1]
  return (
    <>
      <title>{`${name} - ensheetification`}</title>
      <Header />
      <main className="song wrap">
        <Link to="/songs" className="back">Back to My songs</Link>
        <div className="song-head">
          <div>
            <h1>{name}</h1>
            <dl className="song-meta">
              <div><dt>Level</dt><dd>{upload.level} {level.name}</dd></div>
              <div><dt>Uploaded</dt><dd><time dateTime={upload.uploadedAt}>{formatDate(new Date(upload.uploadedAt))}</time></dd></div>
              <div><dt>Status</dt><dd className={upload.status === 'failed' ? 'status-failed' : undefined}>{STATUS_LABEL[upload.status]}</dd></div>
            </dl>
          </div>
          {upload.status === 'ready' && (
            <div className="actions">
              <button type="button" className="secondary" onClick={() => alert(`Coming soon: this will download the MIDI file for ${name}.`)}>MIDI</button>
              <button type="button" className="secondary" onClick={() => alert(`Coming soon: this will download the PDF sheet music for ${name}.`)}>PDF</button>
              <button type="button" className="secondary" onClick={() => alert(`Coming soon: this will download the MusicXML file for ${name}.`)}>MusicXML</button>
            </div>
          )}
        </div>
        <Body upload={upload} />
      </main>
    </>
  )
}
