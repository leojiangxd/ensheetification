import { useState } from 'react'
import { Link } from 'react-router'
import { Header } from '../components/Header'
import { SubmitForm } from '../components/SubmitForm'
import { LEVELS } from '../content'
import { SAMPLE_UPLOADS, STATUS_LABEL, displayName, formatDate, youTubeId, type Upload } from '../uploads'

function Actions({ upload }: { upload: Upload }) {
  const name = displayName(upload)
  if (upload.status === 'arranging') return null
  if (upload.status === 'failed') {
    return (
      <button type="button" className="secondary" onClick={() => alert(`Coming soon: this will try arranging ${name} again.`)}>
        Try again
      </button>
    )
  }
  return (
    <>
      <Link to={`/songs/${upload.id}`} className="secondary">Open</Link>
      <button type="button" className="secondary" onClick={() => alert(`Coming soon: this will download the MIDI file for ${name}.`)}>MIDI</button>
      <button type="button" className="secondary" onClick={() => alert(`Coming soon: this will download the PDF sheet music for ${name}.`)}>PDF</button>
    </>
  )
}

export function Songs() {
  const [level, setLevel] = useState(2)

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
              {SAMPLE_UPLOADS.map((u) => (
                <tr key={u.id}>
                  <th scope="row" className="song-name">
                    {u.source.kind === 'file' ? (
                      u.source.name
                    ) : (
                      // Breakable after the slash so the video id stays on one line.
                      <a href={u.source.url} target="_blank" rel="noreferrer">youtu.be/<wbr />{youTubeId(u.source.url)}</a>
                    )}
                  </th>
                  <td data-label="Level">{u.level} {LEVELS[u.level - 1].name}</td>
                  <td data-label="Uploaded"><time dateTime={u.uploadedAt}>{formatDate(new Date(u.uploadedAt))}</time></td>
                  <td data-label="Status" className={u.status === 'failed' ? 'status-failed' : undefined}>{STATUS_LABEL[u.status]}</td>
                  <td><div className="actions"><Actions upload={u} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </>
  )
}
