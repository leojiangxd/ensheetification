import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { request, usePolled } from '../api'
import { Header } from '../components/Header'
import { SubmitForm } from '../components/SubmitForm'
import { STATUS_LABEL, deleteUpload, displayName, fileUrl, formatDate, isPending, type Upload } from '../uploads'

const anyPending = (jobs: Upload[]) => jobs.some(isPending)

function Actions({ upload, onChanged }: { upload: Upload; onChanged: () => void }) {
  if (upload.status === 'arranging') return null
  const remove = async () => { if (await deleteUpload(upload)) onChanged() }
  const del = <button type="button" className="secondary danger" onClick={remove}>Delete</button>
  if (upload.status === 'queued') return del
  if (upload.status === 'failed') {
    async function retry() {
      try {
        await request(`/jobs/${upload.id}/retry`, { method: 'POST' })
        onChanged()
      } catch (error) {
        alert((error as Error).message)
      }
    }
    return (
      <>
        <Link to={`/songs/${upload.id}`} className="secondary">Open</Link>
        <button type="button" className="secondary" onClick={retry}>Try again</button>
        {del}
      </>
    )
  }
  return (
    <>
      <Link to={`/songs/${upload.id}`} className="secondary">Open</Link>
      <a href={fileUrl(upload, 'midi')} download className="secondary">MIDI</a>
      <a href={fileUrl(upload, 'pdf')} download className="secondary">PDF</a>
      {del}
    </>
  )
}

export function Songs() {
  const [level, setLevel] = useState(2)
  const { data: jobs, error, reload } = usePolled('/jobs', anyPending)

  if (error?.status === 401) return <Navigate to="/login" replace />

  return (
    <>
      <title>My songs - ensheetify</title>
      <Header />
      <main className="songs wrap">
        <section aria-labelledby="new-title">
          <h2 id="new-title">Arrange a new song</h2>
          <SubmitForm level={level} onLevelChange={setLevel} />
        </section>

        <section aria-labelledby="songs-title">
          <h1 id="songs-title">My songs</h1>
          {error ? (
            <p className="notice notice-failed" role="alert">{error.message}</p>
          ) : !jobs ? (
            <p className="notice">Loading your songs...</p>
          ) : jobs.length === 0 ? (
            <p className="notice">No songs yet. Arrange one with the form.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Song</th>
                  <th scope="col">Level</th>
                  <th scope="col">Uploaded</th>
                  <th scope="col">Sheet music</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((u) => (
                  <tr key={u.id}>
                    <th scope="row" className="song-name" title={displayName(u)}>
                      <span>{u.source_url ? <a href={u.source_url} target="_blank" rel="noreferrer">{displayName(u)}</a> : displayName(u)}</span>
                    </th>
                    <td data-label="Level">{u.level}</td>
                    <td data-label="Uploaded"><time dateTime={u.created_at}>{formatDate(new Date(u.created_at))}</time></td>
                    <td>
                      <div className="actions">
                        {u.status !== 'ready' && (
                          <span className={u.status === 'failed' ? 'status status-failed' : 'status'} title={u.error ?? undefined}>
                            {STATUS_LABEL[u.status]}
                          </span>
                        )}
                        <Actions upload={u} onChanged={reload} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </>
  )
}
