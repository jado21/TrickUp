import { StudentHeaderActions } from "../student/StudentHeaderActions";
import { useStudentExperience } from "../student/StudentExperience";
import { motivationMessage } from "../student/motivation-engine";
import { useEffect, useRef, useState } from 'react';
import { Brand, PixelIcon } from '../components/Brand';
import { AcademicGuide, DialogueBubble } from '../courses/guide';
import type { CreatedCourse } from '../courses/types';
import type { StudentProfile } from '../profile-storage';
import { loadMapProgress } from '../learning-map/progress';
import { programmingLearningMap as map } from '../learning-map/programming-data';
import { concepts, FIRST_NODE_ID, gameDefinitions, MISSION_TITLE } from './content';
import { applyAction, createMissionSession, missionCompleted, missionXp, type Feedback, type MissionAction } from './engine';
import { CodeBuilderGame, FallingConceptsGame, MemoryGame } from './games';
import { commitMission, loadMission, saveMission } from './storage';
import { MissionProgressBar, TheoryPanel, useMissionSound } from './ui';
import './mission.css';

export function FirstMissionPage({ profile, course, onMap }: { profile: StudentProfile; course?: CreatedCourse; onMap: (completed: boolean) => void }) {
  if (!course || course.catalogId !== 'demo-programming-1') return <main className="course-shell map-empty-state"><Brand compact /><span className="course-kicker">PRIMERA MISIÓN</span><h1>Primero elige tu curso.</h1><p>Abre Programación I desde tus cursos para jugar su primer subnivel.</p><button className="course-button" onClick={() => onMap(false)}>VOLVER AL MAPA</button></main>;
  return <FirstMission profile={profile} course={course} onMap={onMap} key={course.id} />;
}

function FirstMission({ profile, course, onMap }: { profile: StudentProfile; course: CreatedCourse; onMap: (completed: boolean) => void }) {
  const experience = useStudentExperience();
  const [session, setSession] = useState(() => loadMission(course.id));
  const state = session.state;
  const [theoryOpen, setTheoryOpen] = useState(false);
  const [storageNotice, setStorageNotice] = useState('');
  const [registeredXp, setRegisteredXp] = useState<number | null>(() => loadMapProgress(course.id, map).completions.find(entry => entry.nodeId === FIRST_NODE_ID && entry.source === 'mission')?.xp ?? null);
  const [practice, setPractice] = useState(() => registeredXp !== null && state.phase !== 'complete');
  const sound = useMissionSound();
  const heading = useRef<HTMLHeadingElement>(null);
  const previousFeedback = useRef<Feedback | null>(null);
  const feedback = state.phase === 'memory' ? state.memory.feedback : state.phase === 'rain' ? state.rain.feedback : state.phase === 'builder' ? state.builder.feedback : null;
  useEffect(() => { if (feedback && feedback !== previousFeedback.current) sound.play(feedback.correct); previousFeedback.current = feedback; }, [feedback, sound]);
  useEffect(() => { if (!saveMission(course.id, session)) setStorageNotice('No se pudo guardar en este navegador. Mantén esta pestaña abierta para conservar la misión durante esta sesión.'); }, [course.id, session]);
  useEffect(() => {
    if (state.phase !== 'complete' || !missionCompleted(state)) return;
    const result = commitMission(course.id, session);
    const entry = result.progress.completions.find(item => item.nodeId === FIRST_NODE_ID);
    setRegisteredXp(entry?.xp ?? null);
    if (!result.persisted) setStorageNotice('La misión está completada durante esta sesión, pero no se pudo guardar el resultado en el mapa. Puedes volver a intentar el guardado.');
  }, [course.id, session, state]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); window.scrollTo(0, 0); }, [state.phase]);

  const dispatch = (action: MissionAction) => setSession(previous => applyAction(previous, action));
  const onTheory = () => setTheoryOpen(true);
  const gameProps = { state, dispatch, onTheory, theoryOpen, tone: profile.answers.tone };
  const completedGames = gameDefinitions.filter(game => state[game.id].stats.completed).length;
  const currentDefinition = gameDefinitions.find(game => game.id === state.phase);
  const message = state.phase === 'intro' ? '¡Primera misión! Hoy descubrirás cómo funcionan las clases y los objetos. ¿Listo para empezar?'
    : state.phase === 'complete' ? `¡Lo lograste, ${profile.answers.name}! Ya puedes distinguir clases, objetos, atributos y métodos.`
      : state.phase === 'memory' ? 'Una clase es un molde. Un objeto es un ejemplar. Encuentra sus parejas y descubre cómo encajan.'
        : state.phase === 'rain' ? 'Las ideas también llueven. Elige el bloque que responda a la pregunta; puedes pausar el movimiento cuando quieras.'
          : 'Ahora dale forma a la clase Gato. Cada bloque tiene su lugar; puedes moverlos sin arrastrar.';

  function returnToMap() {
    if (missionCompleted(state) && state.phase === 'complete') {
      const result = commitMission(course.id, session);
      if (!result.persisted) { setStorageNotice('No pudimos guardar el mapa. Tu resultado sigue en esta pestaña; pulsa «REINTENTAR GUARDADO» antes de volver para conservarlo.'); return; }
      onMap(true);
    } else onMap(false);
  }

  return <main className={`course-shell first-mission-shell tone-${profile.experience.messageTone} ${experience.personalization?.visibleHints ? "guided-support" : ""}`}>
    <header className="mission-topbar"><button className="map-back" onClick={returnToMap}>← <span>VOLVER AL MAPA</span></button><div><span className="course-kicker">SEMANA 01 — SUBNIVEL 01</span><strong>INTRODUCCIÓN A LA POO</strong></div><span className="mission-header-xp"><PixelIcon name="bolt" />{state.phase === 'complete' ? `${missionXp(state)} XP · resultado` : 'HASTA 100 XP'}</span><button className="text-button sound-toggle" aria-pressed={!sound.muted} onClick={sound.toggle}>{sound.muted ? 'SONIDO: APAGADO' : 'SONIDO: ENCENDIDO'}</button><StudentHeaderActions /></header>
    <div className="mission-container"><MissionProgressBar state={state} /><div className="mission-title-row"><div><span className="course-kicker">{practice ? 'PRÁCTICA · NO SUMA XP ADICIONAL' : 'TU PRIMERA AVENTURA · TRES DESAFÍOS'}</span><h1 ref={heading} tabIndex={-1}>{state.phase === 'intro' ? 'Introducción a la POO' : state.phase === 'complete' ? '¡SUBNIVEL COMPLETADO!' : currentDefinition?.name}</h1></div><button className="course-button secondary theory-access" onClick={onTheory}><PixelIcon name="book" /> REPASAR TEORÍA</button></div>
      <section className="mission-guide" aria-label="Guía de la misión"><AcademicGuide celebrating={state.phase === 'complete'} /><DialogueBubble key={message} message={`${message} ${motivationMessage(state.phase === "complete" ? "success" : "welcome", profile.answers.tone)}`} subtitle={state.phase === 'intro' ? 'Reconoce clases, objetos, atributos y métodos con tres desafíos, a tu ritmo.' : 'Los contenidos son una adaptación pedagógica del prototipo, no ejercicios extraídos literalmente del sílabo.'} /></section>
      {experience.personalization?.visibleHints && <p className="guided-learning-note">Ayuda guiada: lee el objetivo, responde y revisa la explicación. La teoría es libre y las pistas se solicitan cuando las necesites.</p>}
      {storageNotice && <div className="course-notice" role="status"><span>{storageNotice}</span>{state.phase === 'complete' && <><button className="text-button" onClick={() => { const result = commitMission(course.id, session); if (result.persisted && saveMission(course.id, session)) setStorageNotice('Resultado guardado. Ya puedes volver al mapa.'); }}>REINTENTAR GUARDADO</button><button className="text-button" onClick={() => onMap(false)}>VOLVER AL MAPA SIN GUARDAR</button></>}</div>}
      {state.phase === 'intro' && <section className="mission-start-panel"><div className="mission-start-heading"><span className="course-kicker">TU OBJETIVO</span><h2>{MISSION_TITLE}</h2><p>Reconocer los conceptos básicos de POO y distinguir clases, objetos, atributos y métodos.</p></div><div className="mission-game-cards">{gameDefinitions.map((game, index) => <article key={game.id} className={experience.personalization?.highlightedModes.includes(game.id === "memory" ? "MEMORY_MATCH" : game.id === "rain" ? "FALLING_TILES" : "ORDER_SEQUENCE") ? "recommended-game" : ""}><span>0{index + 1}</span><PixelIcon name={game.id === 'memory' ? 'cards' : game.id === 'rain' ? 'blocks' : 'puzzle'} /><h3>{game.name}</h3><p>PENDIENTE</p><strong>Hasta {game.maxXp} XP</strong>{experience.personalization?.highlightedModes.includes(game.id === "memory" ? "MEMORY_MATCH" : game.id === "rain" ? "FALLING_TILES" : "ORDER_SEQUENCE") && <small className="recommended-game-tag">DESTACADO PARA TI</small>}</article>)}</div><div className="mission-start-actions"><div><strong>{completedGames} / 3 juegos completados</strong><span>La XP se acredita al finalizar los tres.</span></div><button className="course-button" onClick={() => dispatch({ type: 'start' })}>COMENZAR MISIÓN <span>→</span></button></div><details className="scoring-rules"><summary>¿Cómo se calcula mi XP?</summary><p>Memoria: 30 − 2 por error − 2 por pista (mínimo 10). Lluvia: 30 − 3 por error − 2 por pista (mínimo 10). Constructor: 40 − 4 por error − 3 por ayuda (mínimo 15).</p><p>Consultar teoría, quitar el temporizador o pausar el movimiento no penaliza. Repetir una misión completada sirve para practicar y no vuelve a sumar XP.</p></details></section>}
      {state.phase === 'memory' && <MemoryGame {...gameProps} order={session.memoryOrder} />}
      {state.phase === 'rain' && <FallingConceptsGame {...gameProps} />}
      {state.phase === 'builder' && <CodeBuilderGame {...gameProps} />}
      {state.phase === 'complete' && <section className="mission-celebration"><div className="mission-stars" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <i key={index} style={{ '--star': index } as React.CSSProperties}>✦</i>)}</div><div className="mission-complete-emblem"><PixelIcon name="trophy" /></div><span className="course-kicker">TRES JUEGOS. UNA NUEVA HABILIDAD.</span><h2>{missionXp(state)} <span>XP en esta misión{practice ? ' de práctica' : ''}</span></h2><p className="registered-xp">Recompensa registrada en el mapa: <strong>{registeredXp ?? missionXp(state)} XP</strong>. Se concede una sola vez.</p><div className="mission-results">{gameDefinitions.map(game => <article key={game.id}><span>✓ COMPLETADO</span><h3>{game.name}</h3><strong>{state[game.id].stats.xp} / {game.maxXp} XP</strong><p>{state[game.id].stats.attempts} intentos · {state[game.id].stats.mistakes} errores · {state[game.id].stats.hintsUsed} ayudas</p></article>)}</div><div className="learned-concepts">{concepts.map(concept => <span key={concept.id}>{concept.title}</span>)}</div><p>El segundo subnivel está desbloqueado. Tu aprendizaje continúa.</p><button className="course-button" onClick={returnToMap}>VOLVER AL MAPA <span>→</span></button><button className="course-button secondary mission-dashboard-link" onClick={experience.onDashboard}>VER MI PROGRESO</button><button className="text-button mission-replay" onClick={() => { setPractice(true); setSession(createMissionSession()); }}>JUGAR DE NUEVO · SOLO PRÁCTICA</button></section>}
      <footer className="course-footer"><span>TRIKUP <b>×</b> kAIzen</span><span>APRENDE A TU RITMO</span><span>{completedGames} / 3 JUEGOS</span></footer>
    </div>
    {theoryOpen && <TheoryPanel onClose={() => setTheoryOpen(false)} />}
  </main>;
}
