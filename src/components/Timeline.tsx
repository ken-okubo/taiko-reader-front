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

const TECHNIQUE_COLORS: Record<string, string> = {
  don: '#ff6b6b',
  kon: '#6bcbff',
  ka: '#ffd93d',
  ra: '#c084fc',
}

const WINDOW_BEHIND = 1

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

    // ── Responsive parameters ──
    const isMobile = W < 500
    const isNarrow = W < 380
    const windowAhead = isNarrow ? 3 : isMobile ? 4 : 6
    const hitZoneRatio = isMobile ? 0.08 : 0.12
    const headerHeight = 22
    const laneHeight = (H - headerHeight) / trackCount
    const hitX = W * hitZoneRatio
    const pxPerSec = (W - hitX) / windowAhead
    const labelFontSize = isMobile ? 10 : 12
    const sectionFontSize = isMobile ? 10 : 11
    const drumRadius = isMobile ? 10 : 14

    // ── Background ──
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H)
    bgGrad.addColorStop(0, '#0d0b08')
    bgGrad.addColorStop(1, '#12100c')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, W, H)

    // ── Lane backgrounds (subtle alternating) ──
    for (let i = 0; i < trackCount; i++) {
      if (i % 2 === 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.015)'
        ctx.fillRect(0, headerHeight + i * laneHeight, W, laneHeight)
      }
    }

    // ── Hit zone ──
    // Glow
    const glowRadius = isMobile ? 40 : 60
    const glow = ctx.createRadialGradient(hitX, H / 2, 0, hitX, H / 2, glowRadius)
    glow.addColorStop(0, 'rgba(255,255,255,0.06)')
    glow.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = glow
    ctx.fillRect(hitX - glowRadius, headerHeight, glowRadius * 2, H - headerHeight)

    // Line
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(hitX, headerHeight)
    ctx.lineTo(hitX, H)
    ctx.stroke()

    // ── Section lookup ──
    const sectionMap = new Map<number, string>()
    if (score.sections) {
      for (const s of score.sections) sectionMap.set(s.measure, s.name)
    }

    // ── Measure markers + section labels ──
    if (score.timeSignatures.length > 0 && score.tempo > 0) {
      const ts = score.timeSignatures[0]
      const secPerMeasure = (ts.beats * 60) / score.tempo
      const startMeasure = Math.max(1, Math.floor((currentTime - WINDOW_BEHIND) / secPerMeasure) + 1)
      const endMeasure = Math.ceil((currentTime + windowAhead) / secPerMeasure) + 1

      for (let m = startMeasure; m <= endMeasure; m++) {
        const mTime = (m - 1) * secPerMeasure
        const dt = mTime - currentTime
        const x = hitX + dt * pxPerSec
        if (x < hitX - 20 || x > W) continue

        const section = sectionMap.get(m)

        if (section) {
          // Section line — golden, full height
          ctx.strokeStyle = 'rgba(201,160,60,0.3)'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(x, headerHeight)
          ctx.lineTo(x, H)
          ctx.stroke()

          // Section label pill
          ctx.font = `bold ${sectionFontSize}px 'Outfit', system-ui`
          const textW = ctx.measureText(section).width + 10
          const pillH = sectionFontSize + 6
          const pillY = 3

          // Rounded rect background
          const pillX = x - textW / 2
          ctx.fillStyle = 'rgba(201,160,60,0.18)'
          ctx.beginPath()
          ctx.roundRect(pillX, pillY, textW, pillH, 4)
          ctx.fill()

          ctx.fillStyle = '#d9b04c'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(section, x, pillY + pillH / 2)
          ctx.textBaseline = 'alphabetic'
        } else {
          // Regular measure line
          ctx.strokeStyle = 'rgba(255,255,255,0.06)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(x, headerHeight)
          ctx.lineTo(x, H)
          ctx.stroke()

          // Measure number — hide on very narrow screens to reduce clutter
          if (!isNarrow) {
            ctx.fillStyle = 'rgba(255,255,255,0.15)'
            ctx.font = `${isMobile ? 8 : 10}px 'Outfit', system-ui`
            ctx.textAlign = 'center'
            ctx.fillText(`${m}`, x, 14)
          }
        }
      }
    }

    // ── Draw tracks ──
    score.tracks.forEach((track, i) => {
      const isMuted = soloTrack ? track.id !== soloTrack : mutedTracks.has(track.id)
      const trackColor = TRACK_COLORS[track.id] || '#999'
      const centerY = headerHeight + i * laneHeight + laneHeight / 2

      // Track label
      ctx.fillStyle = isMuted ? 'rgba(255,255,255,0.12)' : trackColor
      ctx.font = `bold ${labelFontSize}px 'Outfit', system-ui`
      ctx.textAlign = 'left'
      ctx.fillText(isMobile ? track.name.substring(0, 3) : track.name, 4, centerY + 4)

      // Track center line
      ctx.strokeStyle = isMuted ? 'rgba(255,255,255,0.03)' : `${trackColor}22`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(hitX - 10, centerY)
      ctx.lineTo(W, centerY)
      ctx.stroke()

      // ── Events ──
      const visible = track.events.filter(e => {
        const dt = e.startTime - currentTime
        return dt >= -WINDOW_BEHIND && dt <= windowAhead
      })

      for (let j = 0; j < visible.length; j++) {
        const event = visible[j]
        const dt = event.startTime - currentTime
        const x = hitX + dt * pxPerSec
        const color = TECHNIQUE_COLORS[event.technique] || '#fff'
        const alpha = isMuted ? 0.1 : dt < 0 ? 0.2 : 1
        const isRim = event.technique === 'ka' || event.technique === 'ra'

        // Scale note size — slightly smaller on mobile to reduce overlap
        const baseRadius = isMobile ? 3 : 4
        const maxExtra = isMobile ? 5 : 7
        const radius = baseRadius + (event.velocity / 127) * maxExtra

        // Simultaneous note detection
        const hasSimultaneous =
          (j > 0 && Math.abs(visible[j - 1].startTime - event.startTime) < 0.001) ||
          (j < visible.length - 1 && Math.abs(visible[j + 1].startTime - event.startTime) < 0.001)

        const spread = hasSimultaneous
          ? (isMobile ? 10 : 12)
          : (isMobile ? 6 : 8)
        const noteY = event.hand === 'right' ? centerY - spread : centerY + spread

        ctx.globalAlpha = alpha

        if (isRim) {
          ctx.strokeStyle = color
          ctx.lineWidth = isMobile ? 2 : 2.5
          const s = radius * 0.7
          ctx.beginPath()
          ctx.moveTo(x - s, noteY - s)
          ctx.lineTo(x + s, noteY + s)
          ctx.moveTo(x + s, noteY - s)
          ctx.lineTo(x - s, noteY + s)
          ctx.stroke()
        } else {
          // Subtle glow behind the note
          if (alpha > 0.5 && radius > 6) {
            ctx.beginPath()
            ctx.arc(x, noteY, radius + 3, 0, Math.PI * 2)
            ctx.fillStyle = color
            ctx.globalAlpha = alpha * 0.12
            ctx.fill()
            ctx.globalAlpha = alpha
          }

          ctx.beginPath()
          ctx.arc(x, noteY, radius, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.fill()
        }

        // Accent mark
        if (event.accent) {
          ctx.fillStyle = color
          ctx.font = `bold ${isMobile ? 9 : 11}px system-ui`
          ctx.textAlign = 'center'
          const accentY = event.hand === 'right' ? noteY - radius - 2 : noteY + radius + (isMobile ? 9 : 11)
          ctx.fillText('>', x, accentY)
        }

        ctx.globalAlpha = 1
      }

      // Hit zone drum circle
      ctx.beginPath()
      ctx.arc(hitX, centerY, drumRadius, 0, Math.PI * 2)
      ctx.strokeStyle = isMuted ? 'rgba(255,255,255,0.08)' : trackColor
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Fill with subtle color when not muted
      if (!isMuted) {
        ctx.beginPath()
        ctx.arc(hitX, centerY, drumRadius, 0, Math.PI * 2)
        ctx.fillStyle = `${trackColor}15`
        ctx.fill()
      }
    })

    // ── Time display (top-right) ──
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.font = `${isMobile ? 9 : 11}px 'Outfit', system-ui`
    ctx.textAlign = 'right'
    const mins = Math.floor(currentTime / 60)
    const secs = Math.floor(currentTime % 60)
    ctx.fillText(`${mins}:${secs.toString().padStart(2, '0')}`, W - 6, 14)

  }, [score, currentTime, mutedTracks, soloTrack])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: Math.max(score.tracks.length * 80 + 30, 280),
        borderRadius: 8,
        display: 'block',
      }}
    />
  )
}
