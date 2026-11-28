// Copy mirrors README.md; keep the two in sync.

export type Level = {
  n: number
  name: string
  rightHand: string
  leftHand: string
  rhythm: string
  key: string
}

export const LEVELS: Level[] = [
  { n: 1, name: 'Beginner', rightHand: 'Melody, single notes', leftHand: 'Chord roots, whole and half notes', rhythm: 'Quarter notes', key: 'Transposed to C, G or F' },
  { n: 2, name: 'Easy', rightHand: 'Melody plus occasional 3rd', leftHand: 'Root plus fifth', rhythm: 'Eighth notes', key: 'At most 1 sharp or flat' },
  { n: 3, name: 'Intermediate', rightHand: 'Melody plus 3rds and 6ths', leftHand: 'Block or broken triads', rhythm: 'Eighths, syncopation', key: 'Original key' },
  { n: 4, name: 'Upper intermediate', rightHand: 'Melody, octaves on peaks', leftHand: 'Alberti bass, arpeggios, octave bass', rhythm: 'Sixteenth notes', key: 'Original key' },
  { n: 5, name: 'Advanced', rightHand: 'Full voicings plus fills', leftHand: 'Stride, wide arpeggios', rhythm: 'Sixteenths plus triplets', key: 'Original key' },
]

export const STEPS = [
  { title: 'Submit', body: 'Upload a file or paste a YouTube link, and pick a level from 1 to 5.' },
  { title: 'Ingest', body: 'The audio is decoded and fingerprinted. A song already arranged at that level comes back instantly.' },
  { title: 'Separate', body: 'The mix is split into vocals, bass, drums and everything else.' },
  { title: 'Analyze', body: 'Beats, key, chords and melody are found, and the remaining notes transcribed.' },
  { title: 'Arrange', body: 'A two-staff piano part keeps the melody, fits your level and passes the playability check.' },
  { title: 'Render', body: 'The score is quantized and exported as MusicXML, MIDI, PDF and an audio preview.' },
]

export const OUTPUTS = [
  { title: 'Play it in the browser', body: 'Listen to the arrangement while the score scrolls along with it.', example: 'the in-browser player with a synced, scrolling score' },
  { title: 'MIDI file', body: 'Load it into a DAW, a keyboard, or a learning app.', example: 'a downloadable MIDI file' },
  { title: 'PDF sheet music', body: 'Print it and put it on the stand. MusicXML is included for notation software.', example: 'downloadable PDF and MusicXML files' },
]
