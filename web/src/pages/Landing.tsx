import { useState } from 'react'
import { Header } from '../components/Header'
import { SubmitForm } from '../components/SubmitForm'
import { LEVELS, OUTPUTS, STEPS } from '../content'

export function Landing() {
  const [level, setLevel] = useState(2)

  function chooseLevel(n: number) {
    setLevel(n)
    document.getElementById('start')?.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  return (
    <>
      <Header />

      <main id="top">
        <section className="hero wrap" id="start">
          <div className="hero-copy">
            <h1>Turn any song into a piano arrangement you can actually play.</h1>
            <p className="lede">
              Not a raw transcription. The melody stays, the harmony is re-voiced for piano, and every bar is checked
              to be playable by two hands at the level you choose.
            </p>
          </div>
          <SubmitForm level={level} onLevelChange={setLevel} />
        </section>

        <section className="section wrap" id="levels" aria-labelledby="levels-title">
          <h2 id="levels-title">Five levels, from first lessons to full voicings</h2>
          <table className="level-table">
            <thead>
              <tr>
                <th scope="col">Level</th>
                <th scope="col">Right hand</th>
                <th scope="col">Left hand</th>
                <th scope="col">Rhythm</th>
                <th scope="col">Key</th>
                <th scope="col"><span className="visually-hidden">Choose</span></th>
              </tr>
            </thead>
            <tbody>
              {LEVELS.map((l) => (
                <tr key={l.n} className={l.n === level ? 'is-current' : undefined}>
                  <th scope="row"><span className="level-num">{l.n}</span>{l.name}</th>
                  <td data-label="Right hand">{l.rightHand}</td>
                  <td data-label="Left hand">{l.leftHand}</td>
                  <td data-label="Rhythm">{l.rhythm}</td>
                  <td data-label="Key">{l.key}</td>
                  <td className="level-action">
                    <button type="button" className="secondary" onClick={() => chooseLevel(l.n)} disabled={l.n === level}>
                      {l.n === level ? 'Selected' : `Use level ${l.n}`}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="section wrap" id="how" aria-labelledby="how-title">
          <h2 id="how-title">How it works</h2>
          <ol className="steps">
            {STEPS.map((s) => (
              <li key={s.title}>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="section wrap" id="outputs" aria-labelledby="outputs-title">
          <h2 id="outputs-title">What you get</h2>
          <ul className="outputs">
            {OUTPUTS.map((o) => (
              <li key={o.title}>
                <h3>{o.title}</h3>
                <p>{o.body}</p>
                <button type="button" className="secondary" onClick={() => alert(`Coming soon: an example of ${o.example}.`)}>
                  See an example
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  )
}
