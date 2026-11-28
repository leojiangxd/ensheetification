import { request } from './api'

/** A job as returned by the API (api/db.py JOB_FIELDS). */
export type Upload = {
  id: string
  title: string
  source_kind: 'file' | 'youtube'
  source_url: string | null
  level: number
  status: 'queued' | 'arranging' | 'ready' | 'failed'
  error: string | null
  created_at: string
}

export const STATUS_LABEL = { queued: 'Queued', arranging: 'Arranging', ready: 'Ready', failed: 'Failed' }

export const isPending = (u: Upload) => u.status === 'queued' || u.status === 'arranging'

export const fileUrl = (u: Upload, kind: 'midi' | 'pdf' | 'musicxml') => `/api/jobs/${u.id}/files/${kind}`

export const formatDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format

export function youTubeId(url: string) {
  const u = new URL(url)
  return u.searchParams.get('v') ?? u.pathname.slice(1)
}

/** Same as MAX_TITLE in api/app.py. */
export const MAX_TITLE = 200

/** A YouTube job still showing its raw URL (before the video title is known) gets a short form. */
export function displayName(u: Upload) {
  return u.source_url && u.title === u.source_url ? `youtu.be/${youTubeId(u.source_url)}` : u.title
}

/** Asks for confirmation, then deletes. Returns whether it was deleted; shows failures in an alert. */
export async function deleteUpload(u: Upload) {
  if (!confirm(`Delete "${displayName(u)}"? Its sheet music and files are removed for good.`)) return false
  try {
    await request(`/jobs/${u.id}`, { method: 'DELETE' })
    return true
  } catch (error) {
    alert((error as Error).message)
    return false
  }
}
