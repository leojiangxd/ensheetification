import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { request, usePolled } from '../api'
import { Header } from '../components/Header'
import { LEVELS } from '../content'
import { MAX_TITLE, STATUS_LABEL, deleteUpload, displayName, fileUrl, formatDate, isPending, type Upload } from '../uploads'

function Body({ upload, onRetried }: { upload: Upload; onRetried: () => void }) {
  if (upload.status === 'queued') {
    return <p className="notice">This song is waiting in line. It will start arranging shortly.</p>
  }
  if (upload.status === 'arranging') {
    return <p className="notice">This song is being arranged. This page updates when it's ready.</p>
  }
  if (upload.status === 'failed') {
    async function retry() {
      try {
        await request(`/jobs/${upload.id}/retry`, { method: 'POST' })
        onRetried()
      } catch (error) {
        alert((error as Error).message)
      }
    }
    return (
      <div className="notice notice-failed">
        <p>Arranging this song failed. {upload.error}</p>
        <button type="button" className="secondary" onClick={retry}>Try again</button>
      </div>
    )
  }
  return (
    <>
      <div className="player">
        <button type="button" className="primary play" onClick={() => alert('Coming soon: this will play the arrangement and scroll the score along with it.')}>
          Play
        </button>
      </div>
      <object className="score-pdf" data={fileUrl(upload, 'pdf')} type="application/pdf" aria-label="Sheet music">
        <p className="notice">
          Your browser can't show the PDF here. <a href={fileUrl(upload, 'pdf')} download>Download the sheet music</a> instead.
        </p>
      </object>
    </>
  )
}

function Title({ upload, onRenamed }: { upload: Upload; onRenamed: () => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!draft?.trim()) return setError('Enter a name for this song.')
    setBusy(true)
    try {
      await request(`/jobs/${upload.id}`, { method: 'PATCH', json: { title: draft } })
      setDraft(null)
      setError('')
      onRenamed()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (draft === null) {
    return (
      <div className="title-row">
        <h1>{displayName(upload)}</h1>
        <div className="actions">
          <button type="button" className="secondary" onClick={() => setDraft(displayName(upload))}>Rename</button>
          {upload.status !== 'arranging' && (
            <button type="button" className="secondary danger" onClick={async () => { if (await deleteUpload(upload)) navigate('/songs') }}>
              Delete
            </button>
          )}
        </div>
      </div>
    )
  }
  return (
    <form className="rename" onSubmit={save} noValidate>
      <label className="visually-hidden" htmlFor="song-title">Song name</label>
      <input
        id="song-title"
        className="text-input"
        maxLength={MAX_TITLE}
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setError('') }}
        onKeyDown={(e) => { if (e.key === 'Escape') setDraft(null) }}
        aria-invalid={!!error}
        aria-describedby={error ? 'song-title-error' : undefined}
        autoFocus
      />
      <button type="submit" className="secondary" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
      <button type="button" className="secondary" onClick={() => { setDraft(null); setError('') }}>Cancel</button>
      {error && <p className="error" id="song-title-error" role="alert">{error}</p>}
    </form>
  )
}

function NotFound() {
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

export function Song() {
  const { id } = useParams()
  const { data: upload, error, reload } = usePolled(`/jobs/${id}`, isPending)

  if (error?.status === 401) return <Navigate to="/login" replace />
  if (error?.status === 404) return <NotFound />

  return (
    <>
      <title>{`${upload ? displayName(upload) : 'Song'} - ensheetification`}</title>
      <Header />
      <main className="song wrap">
        <Link to="/songs" className="back">Back to My songs</Link>
        {error ? (
          <p className="notice notice-failed" role="alert">{error.message}</p>
        ) : !upload ? (
          <p className="notice">Loading...</p>
        ) : (
          <>
            <Title upload={upload} onRenamed={reload} />
            <div className="song-head">
              <dl className="song-meta">
                <div><dt>Level</dt><dd>{upload.level} {LEVELS[upload.level - 1].name}</dd></div>
                <div><dt>Uploaded</dt><dd><time dateTime={upload.created_at}>{formatDate(new Date(upload.created_at))}</time></dd></div>
                <div><dt>Status</dt><dd className={upload.status === 'failed' ? 'status-failed' : undefined}>{STATUS_LABEL[upload.status]}</dd></div>
              </dl>
              {upload.status === 'ready' && (
                <div className="actions">
                  <a href={fileUrl(upload, 'midi')} download className="secondary">MIDI</a>
                  <a href={fileUrl(upload, 'pdf')} download className="secondary">PDF</a>
                  <a href={fileUrl(upload, 'musicxml')} download className="secondary">MusicXML</a>
                </div>
              )}
            </div>
            <Body upload={upload} onRetried={reload} />
          </>
        )}
      </main>
    </>
  )
}
