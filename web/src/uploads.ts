export type Upload = {
  id: string
  source: { kind: 'file'; name: string } | { kind: 'youtube'; url: string }
  level: number
  uploadedAt: string
  status: 'ready' | 'arranging' | 'failed'
  durationSec?: number
}

// shortcut: static sample data, replace with GET /jobs and GET /jobs/:id when the API exists
export const SAMPLE_UPLOADS: Upload[] = [
  { id: 'u5', source: { kind: 'youtube', url: 'https://www.youtube.com/watch?v=aBcD3fGh1jK' }, level: 3, uploadedAt: '2026-11-27T14:05:00', status: 'arranging' },
  { id: 'u4', source: { kind: 'file', name: 'voice-memo-1124.m4a' }, level: 1, uploadedAt: '2026-11-24T19:42:00', status: 'failed' },
  { id: 'u3', source: { kind: 'file', name: 'wedding-first-dance.mp3' }, level: 4, uploadedAt: '2026-11-20T10:13:00', status: 'ready', durationSec: 214 },
  { id: 'u2', source: { kind: 'youtube', url: 'https://youtu.be/Zx9Yw8Vu7Ts' }, level: 2, uploadedAt: '2026-11-12T21:30:00', status: 'ready', durationSec: 187 },
  { id: 'u1', source: { kind: 'file', name: 'band-demo-final.wav' }, level: 5, uploadedAt: '2026-10-30T08:55:00', status: 'ready', durationSec: 251 },
]

export const STATUS_LABEL = { ready: 'Ready', arranging: 'Arranging', failed: 'Failed' }

export const formatDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format

export function formatDuration(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

export function youTubeId(url: string) {
  const u = new URL(url)
  return u.searchParams.get('v') ?? u.pathname.slice(1)
}

export function displayName(u: Upload) {
  return u.source.kind === 'file' ? u.source.name : `youtu.be/${youTubeId(u.source.url)}`
}
