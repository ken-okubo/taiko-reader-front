import { useState, useMemo } from 'react';
import { uploadScore } from './api/client';
import { Timeline } from './components/Timeline';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useTheme } from './hooks/useTheme';
import type { SampleMapping, ScorePayload } from './types/score';
// Sample mapping UI disponível em ./components/SampleBrowser — reimportar quando necessário

const SCORES: { name: string; file: string }[] = [
	{ name: 'Gekiryuu', file: 'Gekiryuu_激流_ken.mxl' },
];

const DEFAULT_MAPPING: SampleMapping = {
	shime_don: 'Taiko Drum 5-1.wav',
	shime_ka: 'Taiko Lt Sticks-1.wav',
	shime_kon: 'Taiko Drum 5-1.wav',
	shime_ra: 'Taiko Drum Sticks-1.wav',
	okedo_don: 'Taiko Hit-2.wav',
	okedo_ka: 'Taiko Drum Sticks-1.wav',
	okedo_kon: 'Taiko Hit-2.wav',
	okedo_ra: 'Taiko Drum Sticks-2.wav',
	nagado_don: 'Taiko Drum Hit 1-15.wav',
	nagado_ka: 'Taiko Drum Sticks-1.wav',
	nagado_kon: 'Taiko Drum Hit 1-15.wav',
	nagado_ra: 'Taiko Drum Sticks-2.wav',
};

const TRACK_COLORS: Record<string, string> = {
	shime: '#5dade2',
	okedo: '#f39c12',
	nagado: '#2ecc71',
};

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, '0')}`;
}

function App() {
	const [score, setScore] = useState<ScorePayload | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [sampleMapping] = useState<SampleMapping>(DEFAULT_MAPPING);
	const [mixerOpen, setMixerOpen] = useState(false);

	const engine = useAudioEngine(score, sampleMapping);
	const { theme, toggle: toggleTheme } = useTheme();

	async function loadScore(filename: string) {
		setLoading(true);
		setError('');
		try {
			const res = await fetch(`/partituras/${filename}`);
			if (!res.ok) throw new Error(`Arquivo não encontrado: ${filename}`);
			const blob = await res.blob();
			const file = new File([blob], filename, { type: blob.type });
			const data = await uploadScore(file);
			setScore(data);
		} catch (err) {
			console.error('Load failed:', err);
			setError(
				err instanceof Error ? err.message : 'Falha ao carregar partitura',
			);
		} finally {
			setLoading(false);
		}
	}

	const sampleSlots = score
		? [
				...new Set(
					score.tracks.flatMap((t) => t.events.map((e) => e.sampleFile)),
				),
			]
		: [];

	const allMapped =
		sampleSlots.length > 0 && sampleSlots.every((s) => sampleMapping[s]);

	const canPlay = allMapped && engine.ready;

	// Pre-compute section times
	const sectionTimes = useMemo(() => {
		if (!score?.sections || !score.timeSignatures.length) return [];
		const ts = score.timeSignatures[0] || { beats: 4, beatType: 4 };
		const secPerMeasure = (ts.beats * 60) / score.tempo;
		return score.sections.map((s) => ({
			...s,
			time: (s.measure - 1) * secPerMeasure,
		}));
	}, [score]);

	// Find current section
	const currentSection = useMemo(() => {
		if (!sectionTimes.length) return null;
		for (let i = sectionTimes.length - 1; i >= 0; i--) {
			if (engine.currentTime >= sectionTimes[i].time - 0.05) {
				return sectionTimes[i];
			}
		}
		return null;
	}, [sectionTimes, engine.currentTime]);

	// ─── Landing: no score loaded ───
	if (!score) {
		return (
			<div style={{
				minHeight: '100vh',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				gap: 40,
				padding: 24,
			}}>
				<div style={{ textAlign: 'center' }}>
					<h1 style={{
						fontSize: 42,
						fontWeight: 800,
						letterSpacing: '-0.03em',
						marginBottom: 8,
						color: 'var(--text-primary)',
					}}>
						太鼓 <span style={{ color: 'var(--accent-red)' }}>Reader</span>
					</h1>
					<p style={{
						fontSize: 15,
						color: 'var(--text-muted)',
						fontWeight: 400,
					}}>
						Selecione uma partitura para começar
					</p>
				</div>

				<div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
					{SCORES.map((s) => (
						<button
							key={s.file}
							onClick={() => loadScore(s.file)}
							disabled={loading}
							style={{
								padding: '16px 40px',
								fontSize: 18,
								fontWeight: 700,
								background: 'var(--accent-red)',
								color: '#fff',
								border: 'none',
								borderRadius: 'var(--radius-md)',
								cursor: loading ? 'wait' : 'pointer',
								opacity: loading ? 0.6 : 1,
								boxShadow: '0 4px 16px rgba(201,55,44,0.3)',
							}}
						>
							{s.name}
						</button>
					))}
				</div>

				{loading && (
					<div className="loading-overlay">
						<div className="loader" />
						<span className="loader-text">Carregando partitura...</span>
					</div>
				)}
				{error && (
					<p style={{ color: 'var(--accent-red)', fontSize: 14 }}>{error}</p>
				)}

				<button
					onClick={toggleTheme}
					style={{
						position: 'fixed',
						top: 16,
						right: 16,
						padding: '8px 12px',
						fontSize: 16,
						background: 'var(--bg-btn-neutral)',
						color: 'var(--text-btn-neutral)',
						border: '1px solid var(--border-card)',
						borderRadius: 'var(--radius-sm)',
						cursor: 'pointer',
					}}
					title={theme === 'light' ? 'Tema escuro' : 'Tema claro'}
				>
					{theme === 'light' ? '\u{1F319}' : '\u{2600}\u{FE0F}'}
				</button>

				<p className="credit">por <a href="https://github.com/ken-okubo" target="_blank" rel="noopener noreferrer">Ken Okubo</a></p>
			</div>
		);
	}

	// ─── Player: score loaded ───
	return (
		<div className="player-root">
			{/* ── Header ── */}
			<header className="player-header">
				<div style={{ minWidth: 0 }}>
					<h1 className="player-title">
						{score.title}
					</h1>
					<p className="player-meta">
						{score.composer && <span>{score.composer}</span>}
						{score.composer && score.arranger && <span className="meta-sep">|</span>}
						{score.arranger && <span>Arr. {score.arranger}</span>}
						{(score.composer || score.arranger) && <span className="meta-sep">|</span>}
						<span>{score.tempo} BPM</span>
						<span className="meta-sep">|</span>
						<span>{formatTime(score.totalDurationTime)}</span>
					</p>
				</div>
				<button
					onClick={toggleTheme}
					className="btn-icon"
					title={theme === 'light' ? 'Tema escuro' : 'Tema claro'}
				>
					{theme === 'light' ? '\u{1F319}' : '\u{2600}\u{FE0F}'}
				</button>
			</header>

			{/* ── Section Navigation ── */}
			{sectionTimes.length > 0 && (
				<div className="section-strip">
					{sectionTimes.map((s) => {
						const isCurrent = currentSection?.measure === s.measure;
						return (
							<button
								key={s.measure}
								onClick={() => engine.seek(s.time)}
								className={`section-pill ${isCurrent ? 'section-pill--active' : ''}`}
								title={`${s.name} — compasso ${s.measure}`}
							>
								{s.name}
							</button>
						);
					})}
				</div>
			)}

			{/* ── Timeline ── */}
			<div className="timeline-wrap">
				<Timeline
					score={score}
					currentTime={engine.currentTime}
					mutedTracks={engine.mutedTracks}
					soloTrack={engine.soloTrack}
				/>
			</div>

			{/* ── Legend ── */}
			<div className="legend">
				<span><span style={{ color: '#ff6b6b', fontSize: 13 }}>&#9679;</span> don</span>
				<span><span style={{ color: '#6bcbff', fontSize: 13 }}>&#9679;</span> kon</span>
				<span><span style={{ color: '#ffd93d', fontSize: 13 }}>&#10005;</span> ka</span>
				<span><span style={{ color: '#c084fc', fontSize: 13 }}>&#10005;</span> ra</span>
			</div>

			{/* ── Transport ── */}
			<div className="transport">
				{/* Row 1: Play controls + seek */}
				<div className="transport-main">
					{/* Play/Pause */}
					{engine.isPlaying ? (
						<button onClick={engine.pause} className="btn-play btn-play--pause">
							⏸
						</button>
					) : (
						<button
							onClick={engine.play}
							disabled={!canPlay}
							className="btn-play btn-play--play"
							style={{ opacity: canPlay ? 1 : 0.4 }}
						>
							&#9654;
						</button>
					)}

					{/* Stop */}
					<button
						onClick={engine.stop}
						disabled={!engine.isPlaying && engine.currentTime === 0}
						className="btn-stop"
					>
						&#9632;
					</button>

					{/* Time + Seek */}
					<div className="seek-group">
						<span className="time-display">{formatTime(engine.currentTime)}</span>
						<input
							type='range'
							min='0'
							max={score.totalDurationTime}
							step='0.1'
							value={engine.currentTime}
							onChange={(e) => engine.seek(Number(e.target.value))}
							className="seek-bar"
						/>
						<span className="time-total">{formatTime(score.totalDurationTime / engine.speed)}</span>
					</div>

					{/* Current section badge */}
					{currentSection && (
						<span className="section-badge">{currentSection.name}</span>
					)}
				</div>

				{/* Row 2: BPM + toggles */}
				<div className="transport-controls">
					<div className="control-group">
						<span className="control-label">BPM</span>
						<input
							type='range'
							min={Math.round(score.tempo * 0.25)}
							max={Math.round(score.tempo * 2)}
							step='1'
							value={Math.round(score.tempo * engine.speed)}
							onChange={(e) =>
								engine.setSpeed(Number(e.target.value) / score.tempo)
							}
							className="bpm-slider"
						/>
						<span className="bpm-value">
							{Math.round(score.tempo * engine.speed)}
						</span>
						{engine.speed !== 1 && (
							<button onClick={() => engine.setSpeed(1)} className="btn-reset">
								Reset
							</button>
						)}
					</div>

					<div className="control-toggles">
						<button
							onClick={engine.toggleMetronome}
							className={`btn-toggle ${engine.metronomeOn ? 'btn-toggle--on btn-toggle--metro' : ''}`}
						>
							{engine.metronomeOn ? 'Metronome ON' : 'Metronome OFF'}
						</button>

						<button
							onClick={engine.toggleLoop}
							className={`btn-toggle ${engine.loopEnabled ? 'btn-toggle--on btn-toggle--loop' : ''}`}
						>
							{engine.loopEnabled ? 'Loop ON' : 'Loop OFF'}
						</button>
					</div>

					{engine.loopEnabled && (
						<div className="loop-range">
							<label className="loop-label">
								De
								<input
									type='number'
									min='0'
									max={engine.loopEnd}
									step='0.5'
									value={engine.loopStart}
									onChange={(e) => engine.setLoopStart(Number(e.target.value))}
									className="loop-input"
								/>s
							</label>
							<label className="loop-label">
								até
								<input
									type='number'
									min={engine.loopStart}
									max={score.totalDurationTime}
									step='0.5'
									value={engine.loopEnd}
									onChange={(e) => engine.setLoopEnd(Number(e.target.value))}
									className="loop-input"
								/>s
							</label>
						</div>
					)}
				</div>
			</div>

			{/* ── Mixer ── */}
			<div className="mixer">
				<button
					onClick={() => setMixerOpen(!mixerOpen)}
					className="mixer-toggle"
				>
					<span>Mixer</span>
					<span className={`mixer-arrow ${mixerOpen ? 'mixer-arrow--open' : ''}`}>
						&#9660;
					</span>
				</button>

				{mixerOpen && (
					<div className="mixer-tracks">
						{score.tracks.map((track) => {
							const isMuted = engine.soloTrack
								? track.id !== engine.soloTrack
								: engine.mutedTracks.has(track.id);
							const trackColor = TRACK_COLORS[track.id] || '#999';

							return (
								<div
									key={track.id}
									className="mixer-track"
									style={{ opacity: isMuted ? 0.35 : 1 }}
								>
									<div className="mixer-dot" style={{ background: trackColor }} />
									<span className="mixer-name">{track.name}</span>
									<input
										type='range'
										min='0'
										max='2'
										step='0.05'
										value={engine.trackVolumes[track.id] ?? 1}
										onChange={(e) =>
											engine.setTrackVolume(track.id, Number(e.target.value))
										}
										className="mixer-slider"
										title={`Volume: ${Math.round((engine.trackVolumes[track.id] ?? 1) * 100)}%`}
									/>
									<span className="mixer-pct">
										{Math.round((engine.trackVolumes[track.id] ?? 1) * 100)}%
									</span>
									<button
										onClick={() => engine.toggleMute(track.id)}
										className={`btn-mixer ${engine.mutedTracks.has(track.id) ? 'btn-mixer--muted' : ''}`}
									>
										{engine.mutedTracks.has(track.id) ? 'Muted' : 'Mute'}
									</button>
									<button
										onClick={() => engine.toggleSolo(track.id)}
										className={`btn-mixer ${engine.soloTrack === track.id ? 'btn-mixer--solo' : ''}`}
									>
										{engine.soloTrack === track.id ? 'Solo ON' : 'Solo'}
									</button>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{!allMapped && (
				<div className="loading-overlay">
					<div className="loader" />
					<span className="loader-text">Carregando samples...</span>
				</div>
			)}

			{/* ── Back ── */}
			<div style={{ marginTop: 24, textAlign: 'center', paddingBottom: 16 }}>
				<button
					onClick={() => { engine.stop(); setScore(null); }}
					className="btn-back"
				>
					&#8592; Escolher outra partitura
				</button>
				<p className="credit">por <a href="https://github.com/ken-okubo" target="_blank" rel="noopener noreferrer">Ken Okubo</a></p>
			</div>
		</div>
	);
}

export default App;
