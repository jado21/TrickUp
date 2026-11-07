import { useEffect, useRef, useState } from 'react';
import { PixelIcon } from '../components/Brand';
import { codeBlocks, concepts, fullCode, memoryCards, rainQuestions, type CodeBlockId } from './content';
import type { MissionAction, MissionState } from './engine';
import { FeedbackPanel, GameStatsBar, PerformanceSupport } from './ui';

type GameProps = { state: MissionState; dispatch: (action: MissionAction) => void; onTheory: () => void; tone: string; theoryOpen: boolean };

export function MemoryGame({ state, dispatch, onTheory, tone, order }: GameProps & { order: string[] }) {
  const memory = state.memory;
  const [hintVisible, setHintVisible] = useState(false);
  const hint = () => { if (!hintVisible) { dispatch({ type: 'hint', game: 'memory' }); setHintVisible(true); } };
  return <section className="game-panel memory-game" aria-label="Memoria de conceptos"><div className="game-instructions"><span className="course-kicker">MINIJUEGO 01 · CONECTA LAS IDEAS</span><h2>Encuentra las cuatro parejas.</h2><p>Une cada concepto con su definición. Voltea dos cartas y compara.</p></div><GameStatsBar game="memory" stats={memory.stats} extra={`${memory.matched.length} / 4 parejas`} onHint={hint} hintVisible={hintVisible} /><PerformanceSupport game="memory" stats={memory.stats} tone={tone} onTheory={onTheory} /><progress className="game-completion-progress" aria-label="Parejas encontradas" value={memory.matched.length} max={4} />
    <div className="memory-board">{order.map((id, index) => { const card = memoryCards.find(item => item.id === id)!; const matched = memory.matched.includes(card.concept); const visible = matched || memory.open.includes(id); return <button type="button" key={id} className={`memory-card ${visible ? 'flipped' : ''} ${matched ? 'matched' : ''}`} data-card-id={id} data-visible={visible} aria-label={visible ? `${card.text}${matched ? '. Pareja encontrada' : ''}` : `Carta ${index + 1}, boca abajo`} aria-pressed={visible} disabled={matched || !!memory.feedback || memory.stats.completed} onClick={() => dispatch({ type: 'flip', cardId: id })}><span className="memory-card-back" aria-hidden="true"><span>?</span><small>TRIKUP</small></span><span className="memory-card-front" aria-hidden={!visible}><small>{card.side === 'term' ? 'CONCEPTO' : 'DEFINICIÓN'}</small><strong>{visible ? card.text : ''}</strong>{matched && <span className="pair-check" aria-hidden="true">✓</span>}</span></button>; })}</div>
    {hintVisible && !memory.feedback && <p className="mission-hint">Busca una carta de concepto y una definición: plantilla, ejemplar, dato o acción. Las posiciones no cambian al fallar.</p>}
    {memory.feedback && <FeedbackPanel feedback={memory.feedback} tone={tone} hintVisible={hintVisible} onHint={hint} onTheory={onTheory} onContinue={() => { dispatch({ type: 'continue' }); setHintVisible(false); }} continueLabel={memory.stats.completed ? 'IR A LLUVIA DE CONCEPTOS' : undefined} />}
  </section>;
}

export function FallingConceptsGame(props: GameProps) {
  return <RainQuestion key={props.state.rain.questionIndex} {...props} />;
}

function RainQuestion({ state, dispatch, onTheory, tone, theoryOpen }: GameProps) {
  const rain = state.rain;
  const question = rainQuestions[rain.questionIndex];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [hintVisible, setHintVisible] = useState(false);
  const [motionPaused, setMotionPaused] = useState(reduced);
  const [timed, setTimed] = useState(false);
  const [seconds, setSeconds] = useState(20);
  const [expired, setExpired] = useState(false);
  useEffect(() => { if (rain.stats.mistakes >= 2) { setTimed(false); setExpired(false); } }, [rain.stats.mistakes]);
  const timerPaused = theoryOpen || !!rain.feedback;
  const paused = timerPaused || motionPaused;
  useEffect(() => {
    if (!timed || timerPaused || expired) return;
    const interval = window.setInterval(() => setSeconds(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(interval);
  }, [timed, timerPaused, expired]);
  useEffect(() => { if (timed && seconds === 0) setExpired(true); }, [seconds, timed]);
  const hint = () => { if (!hintVisible) { dispatch({ type: 'hint', game: 'rain' }); setHintVisible(true); } };
  return <section className="game-panel rain-game" aria-label="Lluvia de conceptos"><div className="game-instructions"><span className="course-kicker">MINIJUEGO 02 · ATRAPA LA IDEA CORRECTA</span><h2>{question.question}</h2><p>Pregunta {rain.questionIndex + 1} de {rainQuestions.length}. Usa clic, toque, Tab y Enter o las teclas 1–4 dentro del escenario.</p></div><GameStatsBar game="rain" stats={rain.stats} extra={`Pregunta ${rain.questionIndex + 1} / 3 · hasta 30 XP`} onHint={hint} hintVisible={hintVisible} /><PerformanceSupport game="rain" stats={rain.stats} tone={tone} onTheory={onTheory} /><div className="rain-access-controls"><button className="text-button" aria-pressed={motionPaused} onClick={() => setMotionPaused(value => !value)}>{motionPaused ? 'REANUDAR MOVIMIENTO' : 'PAUSAR MOVIMIENTO'}</button><label><input type="checkbox" checked={timed} onChange={event => { setTimed(event.target.checked); setSeconds(20); setExpired(false); }} /> Reto opcional de 20 s</label>{timed && <span className="rain-countdown" aria-live="off">{seconds} s {timerPaused ? '· pausa' : ''}</span>}</div>
    <div className={`rain-arena ${paused || expired ? 'motion-paused' : ''}`} role="group" aria-label="Bloques de respuesta descendentes" tabIndex={0} onKeyDown={event => { if (!theoryOpen && !rain.feedback && !expired && /^[1-4]$/.test(event.key)) { event.preventDefault(); dispatch({ type: 'answer-rain', answerId: concepts[Number(event.key) - 1].id }); } }}>
      <div className="rain-grid" aria-hidden="true" />{concepts.map((concept, index) => <div className="rain-lane" key={concept.id}><button className={`falling-answer ${rain.selected === concept.id ? rain.feedback?.correct ? 'chosen-correct' : 'chosen-wrong' : ''}`} data-answer-id={concept.id} disabled={!!rain.feedback || expired} style={{ '--lane': index } as React.CSSProperties} aria-keyshortcuts={String(index + 1)} onClick={() => dispatch({ type: 'answer-rain', answerId: concept.id })}><span>{index + 1}</span><strong>{concept.title}</strong><PixelIcon name="gem" /></button></div>)}<div className="rain-floor" aria-hidden="true" />
    </div>
    {expired && !rain.feedback && <div className="timer-expired" role="status"><p>Se acabó el tiempo opcional. No pierdes intentos ni XP: puedes seguir a tu ritmo.</p><button className="course-button secondary" onClick={() => { setTimed(false); setExpired(false); }}>CONTINUAR SIN TEMPORIZADOR</button></div>}
    {hintVisible && !rain.feedback && <p className="mission-hint">{question.hint}</p>}
    {rain.feedback && <FeedbackPanel feedback={rain.feedback} tone={tone} hintVisible={hintVisible} onHint={hint} onTheory={onTheory} onContinue={() => dispatch({ type: 'continue' })} continueLabel={rain.stats.completed ? 'IR AL CONSTRUCTOR DE CÓDIGO' : undefined} />}
  </section>;
}

export function CodeBuilderGame({ state, dispatch, onTheory, tone }: GameProps) {
  const builder = state.builder;
  const [selected, setSelected] = useState<CodeBlockId | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const [solutionVisible, setSolutionVisible] = useState(false);
  const dragging = useRef<CodeBlockId | null>(null);
  const hint = () => { if (!hintVisible) { dispatch({ type: 'hint', game: 'builder' }); setHintVisible(true); } };
  const showSolution = () => { if (!solutionVisible) { dispatch({ type: 'hint', game: 'builder' }); setSolutionVisible(true); } };
  return <section className="game-panel builder-game" aria-label="Constructor de código"><div className="game-instructions"><span className="course-kicker">MINIJUEGO 03 · CONSTRUYE TU PRIMERA CLASE</span><h2>Un pequeño gato. Una gran idea.</h2><p>Ordena los bloques de C# para formar la clase Gato. Selecciona un bloque y luego su destino, usa las flechas o arrastra.</p></div><GameStatsBar game="builder" stats={builder.stats} extra="C# · hasta 40 XP" onHint={hint} hintVisible={hintVisible} />
    <PerformanceSupport game="builder" stats={builder.stats} tone={tone} onTheory={onTheory} /><ol className="code-block-list" aria-label="Bloques de código ordenables">{builder.order.map((id, index) => { const block = codeBlocks.find(item => item.id === id)!; return <li key={id} data-block-id={id} className={selected === id ? 'selected-block' : ''} draggable={!builder.stats.completed} onDragStart={event => { dragging.current = id; event.dataTransfer.setData('text/plain', id); event.dataTransfer.effectAllowed = 'move'; }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const moving = event.dataTransfer.getData('text/plain'); if (dragging.current === moving && codeBlocks.some(item => item.id === moving)) dispatch({ type: 'move-block', blockId: moving as CodeBlockId, target: index }); dragging.current = null; setSelected(null); }} onDragEnd={() => { dragging.current = null; }}><span className="code-line-number">{index + 1}</span><button className="code-select" aria-label={`Bloque ${index + 1}: ${block.code.trim()}. ${selected ? 'Mover bloque seleccionado aquí' : 'Seleccionar para mover'}`} aria-pressed={selected === id} disabled={builder.stats.completed} onClick={() => { if (selected && selected !== id) { dispatch({ type: 'move-block', blockId: selected, target: index }); setSelected(null); } else setSelected(selected === id ? null : id); }}><code>{block.code}</code></button><div className="code-move-buttons"><button aria-label={`Subir bloque ${index + 1}`} disabled={index === 0 || builder.stats.completed} onClick={() => dispatch({ type: 'move-block', blockId: id, target: index - 1 })}>↑</button><button aria-label={`Bajar bloque ${index + 1}`} disabled={index === builder.order.length - 1 || builder.stats.completed} onClick={() => dispatch({ type: 'move-block', blockId: id, target: index + 1 })}>↓</button></div></li>; })}</ol>
    <div className="builder-actions"><button className="text-button" onClick={showSolution} disabled={solutionVisible || builder.stats.completed}>SOLICITAR SOLUCIÓN · CUENTA COMO AYUDA</button><button className="course-button" disabled={builder.stats.completed || !!builder.feedback} onClick={() => dispatch({ type: 'check-code' })}>VERIFICAR CÓDIGO <span>→</span></button></div>
    {hintVisible && !builder.feedback && <p className="mission-hint">La clase contiene un atributo y un método. La instrucción de consola pertenece al método; cada llave tiene una función.</p>}
    {(solutionVisible || builder.stats.completed) && <section className="resolved-code"><h3>{builder.stats.completed ? 'Así se construye una clase.' : 'Solución solicitada'}</h3><pre><code>{fullCode}</code></pre>{builder.stats.completed && <div className="code-explanations">{codeBlocks.filter(block => ['class-header', 'attribute', 'method-header'].includes(block.id)).map(block => <p key={block.id}>{block.explanation}</p>)}<small>Fragmento didáctico: Console pertenece a System. No se ejecuta código en esta demo.</small></div>}</section>}
    {builder.feedback && <FeedbackPanel feedback={builder.feedback} tone={tone} hintVisible={hintVisible} onHint={hint} onTheory={onTheory} onContinue={() => dispatch({ type: 'continue' })} continueLabel={builder.stats.completed ? 'FINALIZAR SUBNIVEL' : undefined} />}
  </section>;
}
