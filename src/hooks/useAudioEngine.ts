import { useCallback, useEffect, useRef, useState } from 'react'
import type { ScorePayload, SampleMapping } from '../types/score'

const METRONOME_SAMPLE = 'Timer Count.wav'

// Base volume multipliers per instrument — invisible to the UI
const BASE_GAIN: Record<string, number> = {
  shime: 1.8,
  nagado: 1.8,
}

export function useAudioEngine(score: ScorePayload | null, sampleMapping: SampleMapping) {
  const contextRef = useRef<AudioContext | null>(null)
  const buffersRef = useRef<Record<string, AudioBuffer>>({})
  const trackGainsRef = useRef<Record<string, GainNode>>({})
  const metronomeGainRef = useRef<GainNode | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const compressorRef = useRef<DynamicsCompressorNode | null>(null)
  const scheduledRef = useRef<AudioBufferSourceNode[]>([])
  const startTimeRef = useRef(0)
  const startOffsetRef = useRef(0)
  const animFrameRef = useRef<number>(0)
  const speedRef = useRef(1)
  const loopRef = useRef<{ start: number; end: number; enabled: boolean }>({ start: 0, end: 0, enabled: false })

  const [isPlaying, setIsPlaying] = useState(false)
  const [ready, setReady] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [metronomeOn, setMetronomeOn] = useState(true)
  const [mutedTracks, setMutedTracks] = useState<Set<string>>(new Set())
  const [soloTrack, setSoloTrack] = useState<string | null>(null)
  const [trackVolumes, setTrackVolumes] = useState<Record<string, number>>({})
  const [loopStart, setLoopStart] = useState(0)
  const [loopEnd, setLoopEnd] = useState(0)
  const [loopEnabled, setLoopEnabled] = useState(false)

  speedRef.current = speed

  // Sync loop ref
  useEffect(() => {
    loopRef.current = { start: loopStart, end: loopEnd, enabled: loopEnabled }
  }, [loopStart, loopEnd, loopEnabled])

  // Init loopEnd when score loads
  useEffect(() => {
    if (score) setLoopEnd(score.totalDurationTime)
  }, [score])

  // Load samples + metronome, create gain nodes
  useEffect(() => {
    const uniqueFiles = new Set(Object.values(sampleMapping).filter(Boolean))
    uniqueFiles.add(METRONOME_SAMPLE)
    if (uniqueFiles.size <= 1 || !score) {
      setReady(false)
      return
    }

    let cancelled = false
    const ctx = new AudioContext()
    contextRef.current = ctx

    // Master pipeline: masterGain → compressor → destination
    const masterGain = ctx.createGain()
    masterGain.gain.value = 0.6
    masterGainRef.current = masterGain

    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -18
    compressor.ratio.value = 4
    compressor.attack.value = 0.01
    compressor.release.value = 0.2
    compressor.knee.value = 6
    compressorRef.current = compressor

    masterGain.connect(compressor)
    compressor.connect(ctx.destination)

    const gains: Record<string, GainNode> = {}
    for (const track of score.tracks) {
      const gain = ctx.createGain()
      gain.connect(masterGain)
      gains[track.id] = gain
    }
    trackGainsRef.current = gains

    const metGain = ctx.createGain()
    metGain.connect(masterGain)
    metronomeGainRef.current = metGain

    async function loadSamples() {
      const buffers: Record<string, AudioBuffer> = {}
      for (const filename of uniqueFiles) {
        try {
          const res = await fetch(`/samples/${filename}`)
          const arrayBuf = await res.arrayBuffer()
          buffers[filename] = await ctx.decodeAudioData(arrayBuf)
        } catch (err) {
          console.warn(`Failed to load sample: ${filename}`, err)
        }
      }
      if (!cancelled) {
        buffersRef.current = buffers
        setReady(true)
      }
    }

    loadSamples()
    return () => {
      cancelled = true
      ctx.close()
      contextRef.current = null
      setReady(false)
    }
  }, [sampleMapping, score])

  // Update track gains in real-time (also re-apply after AudioContext recreation via `ready`)
  useEffect(() => {
    if (!score || !ready) return
    for (const track of score.tracks) {
      const gain = trackGainsRef.current[track.id]
      if (!gain) continue
      const isMuted = soloTrack ? track.id !== soloTrack : mutedTracks.has(track.id)
      const vol = trackVolumes[track.id] ?? 1
      const base = BASE_GAIN[track.sample] ?? 1
      gain.gain.value = isMuted ? 0 : vol * base
    }
  }, [score, mutedTracks, soloTrack, trackVolumes, ready])

  // Update metronome gain in real-time (also re-apply after AudioContext recreation via `ready`)
  useEffect(() => {
    if (metronomeGainRef.current) {
      metronomeGainRef.current.gain.value = metronomeOn ? 0.5 : 0
    }
  }, [metronomeOn, ready])

  const clearScheduled = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current)
    for (const source of scheduledRef.current) {
      try { source.stop() } catch { /* */ }
    }
    scheduledRef.current = []
  }, [])

  const pause = useCallback(() => {
    // Pause at current position — keep currentTime intact
    clearScheduled()
    setIsPlaying(false)
  }, [clearScheduled])

  const stop = useCallback(() => {
    clearScheduled()
    setIsPlaying(false)
    setCurrentTime(0)
  }, [clearScheduled])

  const scheduleFrom = useCallback((fromTime: number, untilTime: number) => {
    if (!score || !contextRef.current) return

    const ctx = contextRef.current
    const spd = speedRef.current
    const now = ctx.currentTime + 0.05
    startTimeRef.current = now
    startOffsetRef.current = fromTime
    const sources: AudioBufferSourceNode[] = []

    // Schedule track events in range
    for (const track of score.tracks) {
      const trackGain = trackGainsRef.current[track.id]
      if (!trackGain) continue

      for (const event of track.events) {
        if (event.startTime < fromTime || event.startTime >= untilTime) continue

        const sampleFileName = sampleMapping[event.sampleFile]
        if (!sampleFileName) continue
        const buffer = buffersRef.current[sampleFileName]
        if (!buffer) continue

        const source = ctx.createBufferSource()
        source.buffer = buffer

        const eventGain = ctx.createGain()
        eventGain.gain.value = event.velocity / 127
        source.connect(eventGain)
        eventGain.connect(trackGain)

        source.start(now + (event.startTime - fromTime) / spd)
        sources.push(source)
      }
    }

    // Schedule metronome in range
    const metBuffer = buffersRef.current[METRONOME_SAMPLE]
    const metGain = metronomeGainRef.current
    if (metBuffer && metGain) {
      const ts = score.timeSignatures[0] || { beats: 4, beatType: 4 }
      const secPerBeat = 60 / score.tempo
      const firstBeat = Math.floor(fromTime / secPerBeat)
      const lastBeat = Math.ceil(untilTime / secPerBeat)

      for (let i = firstBeat; i <= lastBeat; i++) {
        const beatTime = i * secPerBeat
        if (beatTime < fromTime || beatTime >= untilTime) continue

        const source = ctx.createBufferSource()
        source.buffer = metBuffer

        const isDownbeat = i % ts.beats === 0
        const clickGain = ctx.createGain()
        clickGain.gain.value = isDownbeat ? 1 : 0.5
        source.connect(clickGain)
        clickGain.connect(metGain)

        source.start(now + (beatTime - fromTime) / spd)
        sources.push(source)
      }
    }

    scheduledRef.current = sources
  }, [score, sampleMapping])

  const playFrom = useCallback(async (fromTime?: number) => {
    if (!score || !ready || !contextRef.current) return

    const ctx = contextRef.current
    if (ctx.state === 'suspended') await ctx.resume()

    clearScheduled()

    const loop = loopRef.current
    const start = fromTime ?? (loop.enabled ? loop.start : 0)
    const end = loop.enabled ? loop.end : score.totalDurationTime

    scheduleFrom(start, end)
    setIsPlaying(true)

    function tick() {
      if (!contextRef.current) return
      const elapsed = (contextRef.current.currentTime - startTimeRef.current) * speedRef.current
      const scoreTime = startOffsetRef.current + elapsed
      const lp = loopRef.current

      if (lp.enabled && scoreTime >= lp.end) {
        // Loop: restart from loop start
        clearScheduled()
        scheduleFrom(lp.start, lp.end)
        setCurrentTime(lp.start)
        animFrameRef.current = requestAnimationFrame(tick)
        return
      }

      if (scoreTime >= score!.totalDurationTime) {
        clearScheduled()
        setIsPlaying(false)
        setCurrentTime(0)
        return
      }

      setCurrentTime(scoreTime)
      animFrameRef.current = requestAnimationFrame(tick)
    }
    animFrameRef.current = requestAnimationFrame(tick)
  }, [score, ready, clearScheduled, scheduleFrom])

  const play = useCallback(() => {
    // Resume from current position if paused mid-song
    if (currentTime > 0) {
      playFrom(currentTime)
    } else {
      playFrom()
    }
  }, [playFrom, currentTime])

  const seek = useCallback((time: number) => {
    setCurrentTime(time)
    if (isPlaying) {
      playFrom(time)
    }
  }, [isPlaying, playFrom])

  const toggleMute = useCallback((trackId: string) => {
    setMutedTracks(prev => {
      const next = new Set(prev)
      if (next.has(trackId)) next.delete(trackId)
      else next.add(trackId)
      return next
    })
  }, [])

  const toggleSolo = useCallback((trackId: string) => {
    setSoloTrack(prev => prev === trackId ? null : trackId)
  }, [])

  const toggleMetronome = useCallback(() => {
    setMetronomeOn(prev => !prev)
  }, [])

  const setTrackVolume = useCallback((trackId: string, volume: number) => {
    setTrackVolumes(prev => ({ ...prev, [trackId]: volume }))
  }, [])

  const toggleLoop = useCallback(() => {
    setLoopEnabled(prev => !prev)
  }, [])

  // Changing speed while playing causes desync — auto-pause
  const setSpeedSafe = useCallback((newSpeed: number) => {
    if (isPlaying) {
      clearScheduled()
      setIsPlaying(false)
    }
    setSpeed(newSpeed)
  }, [isPlaying, clearScheduled])

  return {
    isPlaying, ready, currentTime, speed, metronomeOn, trackVolumes,
    loopStart, loopEnd, loopEnabled,
    play, pause, stop, seek, setSpeed: setSpeedSafe, toggleMetronome, toggleLoop,
    setLoopStart, setLoopEnd,
    mutedTracks, soloTrack, toggleMute, toggleSolo, setTrackVolume,
  }
}
