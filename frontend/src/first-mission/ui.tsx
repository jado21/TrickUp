import { useEffect, useRef, useState } from 'react';
import { PixelIcon } from '../components/Brand';
import { concepts, gameDefinitions, type GameId } from './content';
import type { Feedback, GameStats, MissionState } from './engine';
import { motivationMessage } from '../student/motivation-engine';
import { adaptToPerformance } from '../student/personalization-engine';

export function TheoryPanel({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef(document.activeElement);
  useEffect(() => { if (!dialog.current?.open) dialog.current?.showModal(); return () => { if (trigger.current instanceof HTMLElement) trigger.current.focus({ preventScroll: true }); }; }, []);
  return <dialog ref={dialog} className="mission-theory" aria-labelledby="theory-title" onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}><div className="theory-inner"><button className="theory-close" aria-label="Cerrar teoría" onClick={onClose}>×</button><span className="course-kicker">TU GUÍA DE BOLSILLO · CONSULTA LIBRE</span><h2 id="theory-title">Programación orientada a objetos</h2><p>La POO organiza el software utilizando clases y objetos.</p><div className="theory-concepts">{concepts.map(concept => <article key={concept.id}><span className="theory-symbol">{concept.id === 'class' ? '{ }' : concept.id === 'object' ? '01' : concept.id === 'attribute' ? 'Aa' : '( )'}</span><h3>{concept.title}</h3><p>{concept.definition}</p><small>{concept.example}</small></article>)}</div><div className="cat-blueprint" aria-label="Ejemplo: la clase Gato define nombre, edad y maullar. Lucho es una instancia de Gato."><div className="cat-class"><span>CLASE</span><strong>Gato</strong><div>nombre · edad</div><code>maullar()</code></div><span className="blueprint-arrow" aria-hidden="true">→</span><div className="cat-instance"><svg viewBox="0 0 32 32" shapeRendering="crispEdges" role="img" aria-label="Gato pixel art original"><path d="M5 3h6v4h10V3h6v21h-4v5H9v-5H5Z" fill="#ffc665" /><path d="M7 6h3v5H7Zm15 0h3v5h-3Z" fill="#e58f4b" /><path d="M10 14h3v4h-3Zm10 0h3v4h-3ZM15 21h4v3h-4Z" fill="#10243a" /><path d="M4 21h6v2H4Zm19 0h6v2h-6Z" fill="#ffe6a3" /></svg><span>OBJETO</span><strong>Lucho</strong><small>nombre = «Lucho» · edad = 2</small></div></div><p className="theory-free-note">Consultar teoría no reduce tu XP. Las pistas explícitas de cada juego se registran por separado.</p><button className="course-button" onClick={onClose}>VOLVER A LA MISIÓN <span>→</span></button></div></dialog>;
}

export function FeedbackPanel({ feedback, tone, onContinue, onTheory, onHint, hintVisible, continueLabel }: { feedback: Feedback; tone: string; onContinue: () => void; onTheory: () => void; onHint: () => void; hintVisible: boolean; continueLabel?: string }) {
  return <section className={`mission-feedback ${feedback.correct ? 'correct' : 'incorrect'}`} aria-label="Retroalimentación"><div className="feedback-heading"><PixelIcon name={feedback.correct ? 'flag' : 'light'} /><strong>{motivationMessage(feedback.correct ? 'success' : 'retry', tone)}</strong></div><p role="status">{feedback.explanation}</p>{!feedback.correct && <><span className="feedback-review">REPASAR: {feedback.concept}</span><div className="feedback-help"><button className="text-button" onClick={onTheory}>REPASAR TEORÍA</button><button className="text-button" onClick={onHint} disabled={hintVisible}>PEDIR UNA PISTA</button></div></>}{hintVisible && <p className="mission-hint"><strong>Pista:</strong> {feedback.hint}</p>}<button className="course-button" onClick={onContinue}>{continueLabel ?? (feedback.correct ? 'CONTINUAR' : 'REINTENTAR')} <span>→</span></button></section>;
}

export function MissionProgressBar({ state }: { state: MissionState }) {
  return <nav className="mission-progress-bar" aria-label="Progreso de los tres minijuegos">{gameDefinitions.map((game, index) => <div key={game.id} className={state[game.id].stats.completed ? 'done' : state.phase === game.id ? 'current' : 'pending'} aria-current={state.phase === game.id ? 'step' : undefined}><span>0{index + 1}</span><strong>{game.shortName}</strong><small>{state[game.id].stats.completed ? 'COMPLETADO' : state.phase === game.id ? 'ACTUAL' : 'PENDIENTE'}</small></div>)}</nav>;
}

export function GameStatsBar({ stats, game, onHint, hintVisible, extra }: { stats: GameStats; game: GameId; onHint: () => void; hintVisible: boolean; extra?: string }) {
  const definition = gameDefinitions.find(item => item.id === game)!;
  return <div className="game-stats-bar"><span>{extra ?? `Hasta ${definition.maxXp} XP`}</span><span>Intentos <strong>{stats.attempts}</strong></span><span>Pistas <strong>{stats.hintsUsed}</strong></span><button className="text-button" onClick={onHint} disabled={hintVisible || stats.completed}><PixelIcon name="light" /> PEDIR PISTA</button></div>;
}

/** Optional synthesized sound. No files, network or autoplay; muted by default. */
export function useMissionSound() {
  const [muted, setMuted] = useState(true);
  const audio = useRef<AudioContext | null>(null);
  useEffect(() => () => { void audio.current?.close().catch(() => undefined); }, []);
  const toggle = () => {
    if (muted) {
      try { audio.current ??= new AudioContext(); void audio.current.resume().catch(() => undefined); } catch { return; }
    }
    setMuted(value => !value);
  };
  const play = (correct: boolean) => {
    if (muted || !audio.current || audio.current.state === 'closed') return;
    const context = audio.current;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square'; oscillator.frequency.value = correct ? 660 : 220;
    gain.gain.setValueAtTime(0.025, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.12);
  };
  return { muted, toggle, play };
}

export function PerformanceSupport({ stats, tone, onTheory, game }: { stats: GameStats; tone: string; onTheory: () => void; game: GameId }) {
  const adaptation = adaptToPerformance(stats);
  if (!adaptation.needsReview && !adaptation.recognizeSuccess) return null;
  const tip = game === 'memory' ? 'Une un término con una definición. Una plantilla es distinta de un ejemplar; un dato es distinto de una acción.' : game === 'rain' ? 'Relee qué pide el enunciado: una plantilla, un dato o una acción. Descarta primero las categorías que no corresponden.' : 'Piensa en qué contiene a qué: la clase engloba el atributo y el método; la instrucción de consola pertenece al método.';
  return <aside className="performance-support" role="status"><PixelIcon name={adaptation.needsReview ? "light" : "flag"} /><div><strong>{motivationMessage(adaptation.needsReview ? "review" : "challenge", tone)}</strong>{adaptation.needsReview && <><p><b>Pista adicional gratuita:</b> {tip}</p><p>Refuerzo sugerido: revisa el diagrama Gato/Lucho y vuelve a intentar. Las preguntas y la regla de puntos se mantienen.</p><button className="text-button" onClick={onTheory}>REPASAR CON CALMA</button></>}</div></aside>;
}
