import { useState } from 'react'

type Props = {
  samples: string[]
  onSelect: (filename: string) => void
}

export function SampleBrowser({ samples, onSelect }: Props) {
  const [playing, setPlaying] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  function playSample(filename: string) {
    setPlaying(filename)
    const audio = new Audio(`/samples/${filename}`)
    audio.onended = () => setPlaying(null)
    audio.play()
  }

  const filtered = samples.filter(s =>
    s.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div style={{ border: '1px solid var(--border-card)', borderRadius: 8, padding: 12, background: 'var(--bg-sample-browser)' }}>
      <input
        type="text"
        placeholder="Filtrar samples..."
        value={filter}
        onChange={e => setFilter(e.target.value)}
        style={{ width: '100%', padding: 6, fontSize: 13, marginBottom: 8, borderRadius: 4, border: '1px solid var(--border-input)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
      />
      <div style={{ maxHeight: 260, overflowY: 'auto' }}>
        {filtered.map(f => (
          <div
            key={f}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 6px',
              borderRadius: 4,
              background: playing === f ? 'var(--bg-sample-playing)' : 'transparent',
              fontSize: 13,
            }}
          >
            <button
              onClick={() => playSample(f)}
              style={{
                width: 28,
                height: 28,
                border: 'none',
                borderRadius: '50%',
                background: playing === f ? 'var(--accent-green)' : 'var(--bg-btn-neutral)',
                color: playing === f ? '#fff' : 'var(--text-btn-neutral)',
                cursor: 'pointer',
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              {playing === f ? '...' : '▶'}
            </button>
            <span
              style={{ flex: 1, cursor: 'pointer' }}
              onClick={() => playSample(f)}
            >
              {f.replace('.wav', '')}
            </span>
            <button
              onClick={() => onSelect(f)}
              style={{
                padding: '2px 10px',
                fontSize: 11,
                border: '1px solid var(--border-input)',
                borderRadius: 4,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              Usar
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
