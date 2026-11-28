import { useId, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { ApiError, request } from '../api'
import { LEVELS } from '../content'
import { MAX_TITLE, type Upload } from '../uploads'
import { GrandStaff } from './GrandStaff'

function isYouTubeUrl(value: string) {
  try {
    const host = new URL(value).hostname.replace(/^(www|m|music)\./, '')
    return host === 'youtube.com' || host === 'youtu.be'
  } catch {
    return false
  }
}

export function SubmitForm({ level, onLevelChange }: { level: number; onLevelChange: (n: number) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const ids = useId()
  const current = LEVELS[level - 1]

  function pickFile(f: File | undefined) {
    if (!f) return
    setFile(f)
    setUrl('')
    setError('')
  }

  function clearFile() {
    setFile(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const link = url.trim()
    if (!file && !link) return setError('Choose an audio file or paste a YouTube link first.')
    if (!file && !isYouTubeUrl(link)) return setError('That is not a YouTube link. Paste one like https://www.youtube.com/watch?v=...')
    setError('')
    const form = new FormData()
    form.set('level', String(level))
    if (title.trim()) form.set('title', title.trim())
    if (file) form.set('file', file)
    else form.set('url', link)
    setBusy(true)
    try {
      const job = await request<Upload>('/jobs', { form })
      navigate(`/songs/${job.id}`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return navigate('/login')
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="submit" onSubmit={submit} noValidate>
      <div
        className={`drop${dragging ? ' is-dragging' : ''}${file ? ' has-file' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files[0]) }}
      >
        <input ref={fileInput} id={`${ids}-file`} type="file" accept="audio/*" className="visually-hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
        {file ? (
          <p className="drop-file">
            <span className="drop-name">{file.name}</span>
            <button type="button" className="link-button" onClick={clearFile}>Remove</button>
          </p>
        ) : (
          <p>
            Drop an audio file here, or <label htmlFor={`${ids}-file`} className="link-button">browse your files</label>
          </p>
        )}
      </div>

      <label className="field-label" htmlFor={`${ids}-url`}>Or paste a YouTube link</label>
      <input
        id={`${ids}-url`}
        className="text-input"
        type="url"
        inputMode="url"
        placeholder="https://www.youtube.com/watch?v=..."
        value={url}
        onChange={(e) => { setUrl(e.target.value); if (e.target.value) clearFile(); setError('') }}
        aria-describedby={error ? `${ids}-error` : undefined}
        aria-invalid={!!error}
      />

      <label className="field-label" htmlFor={`${ids}-title`}>Name <span className="optional">(optional)</span></label>
      <input
        id={`${ids}-title`}
        className="text-input"
        type="text"
        maxLength={MAX_TITLE}
        placeholder={file ? file.name.replace(/\.[^.]+$/, '') : 'Uses the file name or video title'}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <fieldset className="levels">
        <legend className="field-label">Difficulty</legend>
        <div className="level-picker">
          {LEVELS.map((l) => (
            <label key={l.n} className="level-option">
              <input type="radio" name={`${ids}-level`} value={l.n} checked={level === l.n} onChange={() => onLevelChange(l.n)} />
              <span aria-label={`Level ${l.n}, ${l.name}`}>{l.n}</span>
            </label>
          ))}
        </div>
        <p className="level-summary" aria-live="polite">
          <strong>{current.name}.</strong> Right hand: {current.rightHand.toLowerCase()}. Left hand: {current.leftHand.toLowerCase()}.
        </p>
        <GrandStaff level={level} />
      </fieldset>

      {error && <p className="error" id={`${ids}-error`} role="alert">{error}</p>}
      <button type="submit" className="primary" disabled={busy}>{busy ? 'Uploading...' : 'Arrange this song'}</button>
    </form>
  )
}
