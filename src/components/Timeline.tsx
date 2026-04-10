import { useRef, useEffect } from 'react'
import type { ScorePayload } from '../types/score'

type Props = {
  score: ScorePayload
  currentTime: number
  mutedTracks: Set<string>
  soloTrack: string | null
}

const TRACK_COLORS: Record<string, string> = {
  shime: '#5dade2',
  okedo: '#f39c12',
  nagado: '#2ecc71',
}

// Colors by technique
const TECHNIQUE_COLORS: Record<string, string> = {
  don: '#ff6b6b',   // red — center, right hand
  kon: '#6bcbff',   // blue — center, left hand
  ka: '#ffd93d',    // yellow — rim, right hand
  ra: '#c084fc',    // purple — rim, left hand
}

const WINDOW_AHEAD = 6
const WINDOW_BEHIND = 1
const HIT_ZONE = 0.12

export function Timeline({ score, currentTime, mutedTracks, soloTrack }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const W = rect.width
    const H = rect.height
    const trackCount = score.tracks.length
    const laneHeight = (H - 30) / trackCount
    const hitX = W * HIT_ZONE
    const pxPerSec = (W - hitX) / WINDOW_AHEAD

    // Background
    ctx.fillStyle = '#0f0f1a'
    ctx.fillRect(0, 0, W, H)

    // Hit zone line
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(hitX, 20)
    ctx.lineTo(hitX, H)
    ctx.stroke()

    // Hit zone glow
    const glow = ctx.createRadialGradient(hitX, H / 2, 0, hitX, H / 2, 60)
    glow.addColorStop(0, 'rgba(255,255,255,0.08)')
    glow.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = glow
    ctx.fillRect(hitX - 60, 20, 120, H - 20)

    // Build section lookup (measure → name) for quick access
    const sectionMap = new Map<number, string>()
    if (score.sections) {
      for (const s of score.sections) sectionMap.set(s.measure, s.name)
    }

    // Measure markers + section labels
    if (score.timeSignatures.length > 0 && score.tempo > 0) {
      const ts = score.timeSignatures[0]
      const secPerMeasure = (ts.beats * 60) / score.tempo
      const startMeasure = Math.max(1, Math.floor((currentTime - WINDOW_BEHIND) / secPerMeasure) + 1)
      const endMeasure = Math.ceil((currentTime + WINDOW_AHEAD) / secPerMeasure) + 1

      ctx.fillStyle = 'rgba(255,255,255,0.2)'
      ctx.font = '10px system-ui'
      ctx.textAlign = 'center'

      for (let m = startMeasure; m <= endMeasure; m++) {
        const mTime = (m - 1) * secPerMeasure
        const dt = mTime - currentTime
        const x = hitX + dt * pxPerSec
        if (x < hitX - 20 || x > W) continue

        const section = sectionMap.get(m)

        // Section start: brighter line
        ctx.strokeStyle = section ? 'rgba(255,200,50,0.35)' : 'rgba(255,255,255,0.08)'
        ctx.lineWidth = section ? 2 : 1
        ctx.beginPath()
        ctx.moveTo(x, 20)
        ctx.lineTo(x, H)
        ctx.stroke()

        if (section) {
          // Section label with background
          ctx.font = 'bold 11px system-ui'
          const textW = ctx.measureText(section).width + 8
          ctx.fillStyle = 'rgba(255,200,50,0.15)'
          ctx.fillRect(x - textW / 2, 2, textW, 16)
          ctx.fillStyle = '#ffc832'
          ctx.textAlign = 'center'
          ctx.fillText(section, x, 14)
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.2)'
          ctx.font = '10px system-ui'
          ctx.textAlign = 'center'
          ctx.fillText(`${m}`, x, 14)
        }
      }
    }

    // Draw each track
    score.tracks.forEach((track, i) => {
      const isMuted = soloTrack ? track.id !== soloTrack : mutedTracks.has(track.id)
      const trackColor = TRACK_COLORS[track.id] || '#999'
      const centerY = 25 + i * laneHeight + laneHeight / 2

      // Track label
      ctx.fillStyle = isMuted ? 'rgba(255,255,255,0.15)' : trackColor
      ctx.font = 'bold 12px system-ui'
      ctx.textAlign = 'left'
      ctx.fillText(track.name, 6, centerY + 4)

      // Track lane line
      ctx.strokeStyle = isMuted ? 'rgba(255,255,255,0.05)' : `${trackColor}33`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(hitX - 20, centerY)
      ctx.lineTo(W, centerY)
      ctx.stroke()

      // Collect visible events and group simultaneous ones
      const visible = track.events.filter(e => {
        const dt = e.startTime - currentTime
        return dt >= -WINDOW_BEHIND && dt <= WINDOW_AHEAD
      })

      // Draw events — offset simultaneous notes so both are visible
      for (let j = 0; j < visible.length; j++) {
        const event = visible[j]
        const dt = event.startTime - currentTime
        const x = hitX + dt * pxPerSec
        const color = TECHNIQUE_COLORS[event.technique] || '#fff'
        const alpha = isMuted ? 0.12 : dt < 0 ? 0.25 : 1
        const isRim = event.technique === 'ka' || event.technique === 'ra'
        // Radius scales with velocity: ppp(16)→4, fff(127)→11
        const radius = 4 + (event.velocity / 127) * 7

        // Check if next event is simultaneous (same startTime)
        const hasSimultaneous =
          (j > 0 && Math.abs(visible[j - 1].startTime - event.startTime) < 0.001) ||
          (j < visible.length - 1 && Math.abs(visible[j + 1].startTime - event.startTime) < 0.001)

        // Position: right hand above, left hand below
        // If simultaneous, push further apart so both are visible
        const spread = hasSimultaneous ? 12 : 8
        const noteY = event.hand === 'right' ? centerY - spread : centerY + spread

        ctx.globalAlpha = alpha

        if (isRim) {
          // X for rim hits
          ctx.strokeStyle = color
          ctx.lineWidth = 2.5
          const s = radius * 0.7
          ctx.beginPath()
          ctx.moveTo(x - s, noteY - s)
          ctx.lineTo(x + s, noteY + s)
          ctx.moveTo(x + s, noteY - s)
          ctx.lineTo(x - s, noteY + s)
          ctx.stroke()
        } else {
          // Filled circle for center hits
          ctx.beginPath()
          ctx.arc(x, noteY, radius, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.fill()
        }

        // Accent mark
        if (event.accent) {
          ctx.fillStyle = color
          ctx.font = 'bold 11px system-ui'
          ctx.textAlign = 'center'
          const accentY = event.hand === 'right' ? noteY - radius - 3 : noteY + radius + 11
          ctx.fillText('>', x, accentY)
        }

        ctx.globalAlpha = 1
      }

      // Hit zone drum
      ctx.beginPath()
      ctx.arc(hitX, centerY, 14, 0, Math.PI * 2)
      ctx.strokeStyle = isMuted ? 'rgba(255,255,255,0.1)' : trackColor
      ctx.lineWidth = 2
      ctx.stroke()
    })

    // Time
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = '11px system-ui'
    ctx.textAlign = 'right'
    ctx.fillText(`${currentTime.toFixed(1)}s / ${score.totalDurationTime.toFixed(1)}s`, W - 8, 14)

  }, [score, currentTime, mutedTracks, soloTrack])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: score.tracks.length * 70 + 30,
        borderRadius: 8,
        display: 'block',
      }}
    />
  )
}
