import type { ScorePayload } from '../types/score'

const API_BASE = import.meta.env.VITE_API_BASE || ''

export async function uploadScore(file: File): Promise<ScorePayload> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE}/scores/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to upload score.')
  }

  return response.json()
}
