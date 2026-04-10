import { useState } from 'react';
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

function App() {
	const [score, setScore] = useState<ScorePayload | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [sampleMapping] = useState<SampleMapping>(DEFAULT_MAPPING);

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

	return (
		<div
			style={{
				maxWidth: 1100,
				margin: '0 auto',
				padding: 24,
				fontFamily: 'system-ui, sans-serif',
			}}
		>
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					borderBottom: '2px solid var(--border-primary)',
					paddingBottom: 8,
					marginBottom: 24,
				}}
			>
				<h1 style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: 0 }}>
					Taiko Reader
				</h1>
				<button
					onClick={toggleTheme}
					style={{
						padding: '6px 14px',
						fontSize: 18,
						background: 'var(--bg-btn-neutral)',
						color: 'var(--text-btn-neutral)',
						border: '1px solid var(--border-card)',
						borderRadius: 8,
						cursor: 'pointer',
						transition: 'background 0.2s',
					}}
					title={
						theme === 'light'
							? 'Mudar para tema escuro'
							: 'Mudar para tema claro'
					}
				>
					{theme === 'light' ? '\u{1F319}' : '\u{2600}\u{FE0F}'}
				</button>
			</div>

			{/* Score selection */}
			<section style={{ marginBottom: 32 }}>
				<h2>Partitura</h2>
				<div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
					{SCORES.map((s) => (
						<button
							key={s.file}
							onClick={() => loadScore(s.file)}
							disabled={loading}
							style={{
								padding: '10px 28px',
								fontSize: 15,
								fontWeight: 600,
								background: score?.title
									?.toLowerCase()
									.includes(s.name.toLowerCase())
									? 'var(--accent-blue)'
									: 'var(--bg-btn-neutral)',
								color: score?.title
									?.toLowerCase()
									.includes(s.name.toLowerCase())
									? '#fff'
									: 'var(--text-btn-neutral)',
								border: '1px solid var(--border-card)',
								borderRadius: 8,
								cursor: loading ? 'wait' : 'pointer',
								opacity: loading ? 0.6 : 1,
								transition: 'all 0.2s',
							}}
						>
							{s.name}
						</button>
					))}
				</div>
				{loading && (
					<p
						style={{
							color: 'var(--accent-blue)',
							fontWeight: 600,
							marginTop: 8,
						}}
					>
						Carregando e parseando...
					</p>
				)}
				{error && (
					<p style={{ color: 'var(--accent-red)', marginTop: 8 }}>{error}</p>
				)}
			</section>

			{score && (
				<>
					{/* Score info */}
					<section
						style={{
							marginBottom: 32,
							padding: 16,
							background: 'var(--bg-secondary)',
							borderRadius: 8,
							border: '1px solid var(--border-secondary)',
						}}
					>
						<h2 style={{ marginTop: 0 }}>{score.title}</h2>
						<p style={{ color: 'var(--text-secondary)' }}>
							{score.composer && <>{score.composer}</>}
							{score.composer && score.arranger && ' · '}
							{score.arranger && <>Arr. {score.arranger}</>}
						</p>
						<p style={{ color: 'var(--text-secondary)' }}>
							{score.tempo} BPM &middot; {score.totalDurationTime.toFixed(1)}s
							&middot;{' '}
							{Math.max(
								...score.tracks.flatMap((t) => t.events.map((e) => e.measure)),
							)}{' '}
							compassos
						</p>
						{score.tracks.map((t) => (
							<span key={t.id} style={{ marginRight: 16, fontSize: 14 }}>
								<strong>{t.name}</strong>: {t.events.length} eventos
							</span>
						))}
					</section>

					{/* Player */}
					<section style={{ marginBottom: 32 }}>
						{!allMapped && (
							<p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
								Configurando samples...
							</p>
						)}

						<div
							style={{
								display: 'flex',
								gap: 8,
								alignItems: 'center',
								marginBottom: 12,
								flexWrap: 'wrap',
							}}
						>
							{/* Play / Pause / Stop */}
							<button
								onClick={engine.play}
								disabled={!allMapped || !engine.ready || engine.isPlaying}
								style={{
									padding: '8px 24px',
									fontSize: 15,
									fontWeight: 600,
									cursor:
										allMapped && engine.ready && !engine.isPlaying
											? 'pointer'
											: 'not-allowed',
									background: 'var(--accent-green)',
									color: '#fff',
									border: 'none',
									borderRadius: 6,
									opacity:
										allMapped && engine.ready && !engine.isPlaying ? 1 : 0.4,
								}}
							>
								▶ Tocar
							</button>
							<button
								onClick={engine.pause}
								disabled={!engine.isPlaying}
								style={{
									padding: '8px 20px',
									fontSize: 15,
									fontWeight: 600,
									cursor: engine.isPlaying ? 'pointer' : 'not-allowed',
									background: 'var(--accent-orange)',
									color: '#fff',
									border: 'none',
									borderRadius: 6,
									opacity: engine.isPlaying ? 1 : 0.4,
								}}
							>
								⏸ Pausar
							</button>
							<button
								onClick={engine.stop}
								disabled={!engine.isPlaying && engine.currentTime === 0}
								style={{
									padding: '8px 20px',
									fontSize: 15,
									fontWeight: 600,
									cursor:
										engine.isPlaying || engine.currentTime > 0
											? 'pointer'
											: 'not-allowed',
									background: 'var(--accent-red)',
									color: '#fff',
									border: 'none',
									borderRadius: 6,
									opacity: engine.isPlaying || engine.currentTime > 0 ? 1 : 0.4,
								}}
							>
								⏹ Parar
							</button>

							{/* Metronome toggle */}
							<button
								onClick={engine.toggleMetronome}
								style={{
									padding: '6px 14px',
									fontSize: 13,
									background: engine.metronomeOn
										? 'var(--accent-purple)'
										: 'var(--bg-btn-neutral)',
									color: engine.metronomeOn
										? '#fff'
										: 'var(--text-btn-neutral)',
									border: 'none',
									borderRadius: 4,
									cursor: 'pointer',
								}}
							>
								{engine.metronomeOn ? 'Metronome ON' : 'Metronome OFF'}
							</button>

							<span
								style={{
									fontSize: 14,
									color: 'var(--text-secondary)',
									fontVariantNumeric: 'tabular-nums',
								}}
							>
								{engine.currentTime.toFixed(1)}s /{' '}
								{(score.totalDurationTime / engine.speed).toFixed(1)}s
							</span>
						</div>

						{/* BPM slider */}
						<div
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: 10,
								marginBottom: 16,
							}}
						>
							<label
								style={{
									fontSize: 13,
									color: 'var(--text-secondary)',
									whiteSpace: 'nowrap',
								}}
							>
								BPM:
							</label>
							<input
								type='range'
								min={Math.round(score.tempo * 0.25)}
								max={Math.round(score.tempo * 2)}
								step='1'
								value={Math.round(score.tempo * engine.speed)}
								onChange={(e) =>
									engine.setSpeed(Number(e.target.value) / score.tempo)
								}
								style={{ flex: 1, maxWidth: 300 }}
							/>
							<span
								style={{
									fontSize: 14,
									fontWeight: 600,
									fontVariantNumeric: 'tabular-nums',
									minWidth: 80,
								}}
							>
								{Math.round(score.tempo * engine.speed)} BPM
								<span
									style={{
										fontSize: 11,
										fontWeight: 400,
										color: 'var(--text-dimmed)',
									}}
								>
									{' '}
									({engine.speed.toFixed(2)}x)
								</span>
							</span>
							<button
								onClick={() => engine.setSpeed(1)}
								style={{
									padding: '3px 10px',
									fontSize: 11,
									background:
										engine.speed === 1
											? 'var(--accent-blue)'
											: 'var(--bg-btn-neutral)',
									color:
										engine.speed === 1 ? '#fff' : 'var(--text-btn-neutral)',
									border: 'none',
									borderRadius: 4,
									cursor: 'pointer',
								}}
							>
								Reset ({score.tempo})
							</button>
						</div>

						{/* Seek bar */}
						<div style={{ marginBottom: 12 }}>
							<input
								type='range'
								min='0'
								max={score.totalDurationTime}
								step='0.1'
								value={engine.currentTime}
								onChange={(e) => engine.seek(Number(e.target.value))}
								style={{ width: '100%' }}
							/>
						</div>

						{/* Section badges */}
						{score.sections && score.sections.length > 0 && (
							<div
								style={{
									display: 'flex',
									gap: 6,
									flexWrap: 'wrap',
									marginBottom: 10,
								}}
							>
								{score.sections.map((s) => {
									const ts = score.timeSignatures[0] || {
										beats: 4,
										beatType: 4,
									};
									const secPerMeasure = (ts.beats * 60) / score.tempo;
									const sectionTime = (s.measure - 1) * secPerMeasure;
									return (
										<button
											key={s.measure}
											onClick={() => engine.seek(sectionTime)}
											style={{
												padding: '3px 10px',
												fontSize: 11,
												fontWeight: 600,
												background: 'var(--accent-blue)',
												color: '#fff',
												border: 'none',
												borderRadius: 4,
												cursor: 'pointer',
												opacity: 0.85,
											}}
											title={`Compasso ${s.measure} (${sectionTime.toFixed(1)}s)`}
										>
											{s.name}
										</button>
									);
								})}
							</div>
						)}

						{/* Loop controls */}
						<div
							style={{
								display: 'flex',
								gap: 12,
								alignItems: 'center',
								marginBottom: 16,
								flexWrap: 'wrap',
							}}
						>
							<button
								onClick={engine.toggleLoop}
								style={{
									padding: '4px 14px',
									fontSize: 13,
									background: engine.loopEnabled
										? 'var(--accent-loop)'
										: 'var(--bg-btn-neutral)',
									color: engine.loopEnabled
										? '#fff'
										: 'var(--text-btn-neutral)',
									border: 'none',
									borderRadius: 4,
									cursor: 'pointer',
								}}
							>
								{engine.loopEnabled ? 'Loop ON' : 'Loop OFF'}
							</button>

							{engine.loopEnabled && (
								<>
									<label
										style={{
											fontSize: 13,
											color: 'var(--text-secondary)',
											display: 'flex',
											alignItems: 'center',
											gap: 4,
										}}
									>
										Início:
										<input
											type='number'
											min='0'
											max={engine.loopEnd}
											step='0.5'
											value={engine.loopStart}
											onChange={(e) =>
												engine.setLoopStart(Number(e.target.value))
											}
											style={{ width: 65, padding: 3, fontSize: 13 }}
										/>
										s
									</label>
									<label
										style={{
											fontSize: 13,
											color: 'var(--text-secondary)',
											display: 'flex',
											alignItems: 'center',
											gap: 4,
										}}
									>
										Fim:
										<input
											type='number'
											min={engine.loopStart}
											max={score.totalDurationTime}
											step='0.5'
											value={engine.loopEnd}
											onChange={(e) =>
												engine.setLoopEnd(Number(e.target.value))
											}
											style={{ width: 65, padding: 3, fontSize: 13 }}
										/>
										s
									</label>
									<span style={{ fontSize: 12, color: 'var(--text-dimmed)' }}>
										(trecho: {(engine.loopEnd - engine.loopStart).toFixed(1)}s)
									</span>
								</>
							)}
						</div>

						{/* Timeline — Tatsujin style */}
						<div style={{ marginBottom: 16 }}>
							<Timeline
								score={score}
								currentTime={engine.currentTime}
								mutedTracks={engine.mutedTracks}
								soloTrack={engine.soloTrack}
							/>
						</div>

						{/* Legenda */}
						<div
							style={{
								display: 'flex',
								gap: 16,
								fontSize: 12,
								color: 'var(--text-muted)',
								marginBottom: 16,
								flexWrap: 'wrap',
							}}
						>
							<span>
								<span style={{ color: '#ff6b6b' }}>●</span> don (centro,
								direita)
							</span>
							<span>
								<span style={{ color: '#6bcbff' }}>●</span> kon (centro,
								esquerda)
							</span>
							<span>
								<span style={{ color: '#ffd93d' }}>✕</span> ka (borda, direita)
							</span>
							<span>
								<span style={{ color: '#c084fc' }}>✕</span> ra (borda, esquerda)
							</span>
							<span>| grande = acento</span>
						</div>

						{/* Mixer */}
						<div
							style={{
								border: '1px solid var(--border-secondary)',
								borderRadius: 8,
								padding: 16,
							}}
						>
							<h3 style={{ marginTop: 0, fontSize: 15 }}>Mixer</h3>
							{score.tracks.map((track) => {
								const isMuted = engine.soloTrack
									? track.id !== engine.soloTrack
									: engine.mutedTracks.has(track.id);

								return (
									<div
										key={track.id}
										style={{
											display: 'flex',
											gap: 10,
											alignItems: 'center',
											padding: '6px 0',
											opacity: isMuted ? 0.35 : 1,
											transition: 'opacity 0.2s',
										}}
									>
										<strong style={{ width: 70, fontSize: 14 }}>
											{track.name}
										</strong>
										<input
											type='range'
											min='0'
											max='2'
											step='0.05'
											value={engine.trackVolumes[track.id] ?? 1}
											onChange={(e) =>
												engine.setTrackVolume(track.id, Number(e.target.value))
											}
											style={{ width: 100 }}
											title={`Volume: ${Math.round((engine.trackVolumes[track.id] ?? 1) * 100)}%`}
										/>
										<span
											style={{
												width: 38,
												fontSize: 11,
												color: 'var(--text-muted)',
												textAlign: 'right',
											}}
										>
											{Math.round((engine.trackVolumes[track.id] ?? 1) * 100)}%
										</span>
										<button
											onClick={() => engine.toggleMute(track.id)}
											style={{
												padding: '3px 14px',
												fontSize: 13,
												background: engine.mutedTracks.has(track.id)
													? 'var(--accent-red)'
													: 'var(--bg-btn-neutral)',
												color: engine.mutedTracks.has(track.id)
													? '#fff'
													: 'var(--text-btn-neutral)',
												border: 'none',
												borderRadius: 4,
												cursor: 'pointer',
											}}
										>
											{engine.mutedTracks.has(track.id) ? 'Muted' : 'Mute'}
										</button>
										<button
											onClick={() => engine.toggleSolo(track.id)}
											style={{
												padding: '3px 14px',
												fontSize: 13,
												background:
													engine.soloTrack === track.id
														? 'var(--accent-orange)'
														: 'var(--bg-btn-neutral)',
												color:
													engine.soloTrack === track.id
														? '#fff'
														: 'var(--text-btn-neutral)',
												border: 'none',
												borderRadius: 4,
												cursor: 'pointer',
											}}
										>
											{engine.soloTrack === track.id ? 'Solo ON' : 'Solo'}
										</button>
									</div>
								);
							})}
						</div>
					</section>
				</>
			)}
		</div>
	);
}

export default App;
