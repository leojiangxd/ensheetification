import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { request, usePolled } from '../api'
import { Header } from '../components/Header'
import { SubmitForm } from '../components/SubmitForm'
import { LEVELS } from '../content'
import { STATUS_LABEL, displayName, fileUrl, formatDate, isPending, type Upload } from '../uploads'

const anyPending = (jobs: Upload[]) => jobs.some(isPending)

function Actions({ upload, onRetried }: { upload: Upload; onRetried: () => void }) {
  if (isPending(upload)) return null
  if (upload.status === 'failed') {
    async function retry() {
      try {
        await request(`/jobs/${upload.id}/retry`, { method: 'POST' })
        onRetried()
      } catch (error) {
        alert((error as Error).message)
      }
    }
    return <button type="button" className="secondary" onClick={retry}>Try again</button>
  }
  return (
    <>
      <Link to={`/songs/${upload.id}`} className="secondary">Open</Link>
      <a href={fileUrl(upload, 'midi')} download className="secondary">MIDI</a>
      <a href={fileUrl(upload, 'pdf')} download className="secondary">PDF</a>
    </>
  )
}

export function Songs() {
  const [level, setLevel] = useState(2)
  const { data: jobs, error, reload } = usePolled('/jobs', anyPending)

  if (error?.status === 401) return <Navigate to="/login" replace />

  return (
    <>
      <title>My songs - ensheetification</title>
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
                  <th scope="col">Status</th>
                  <th scope="col"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((u) => (
                  <tr key={u.id}>
                    <th scope="row" className="song-name">
                      {u.source_url ? <a href={u.source_url} target="_blank" rel="noreferrer">{displayName(u)}</a> : displayName(u)}
                    </th>
                    <td data-label="Level">{u.level} {LEVELS[u.level - 1].name}</td>
                    <td data-label="Uploaded"><time dateTime={u.created_at}>{formatDate(new Date(u.created_at))}</time></td>
                    <td data-label="Status" className={u.status === 'failed' ? 'status-failed' : undefined} title={u.error ?? undefined}>
                      {STATUS_LABEL[u.status]}
                    </td>
                    <td><div className="actions"><Actions upload={u} onRetried={reload} /></div></td>
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
