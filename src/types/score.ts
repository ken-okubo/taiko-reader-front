export type TimeSignature = {
  measure: number
  beats: number
  beatType: number
}

export type ScoreEvent = {
  eventId: string
  measure: number
  beat: number
  start: number
  startTime: number
  duration: number
  durationTime: number
  velocity: number
  accent: boolean
  hand: 'right' | 'left'
  technique: 'don' | 'ka' | 'kon' | 'ra'
  sampleFile: string
}

export type ScoreTrack = {
  id: string
  name: string
  sample: string
  events: ScoreEvent[]
}

export type Section = {
  measure: number
  name: string
}

export type ScorePayload = {
  title: string
  composer: string | null
  arranger: string | null
  tempo: number
  totalDuration: number
  totalDurationTime: number
  timeSignatures: TimeSignature[]
  sections: Section[]
  tracks: ScoreTrack[]
}

export type SampleMapping = Record<string, string>
