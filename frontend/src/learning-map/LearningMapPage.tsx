import { StudentHeaderActions } from "../student/StudentHeaderActions";
import { useStudentExperience } from "../student/StudentExperience";
import { motivationMessage } from "../student/motivation-engine";
import { useEffect, useRef, useState } from 'react';
import { Brand, PixelIcon } from '../components/Brand';
import { AcademicGuide, DialogueBubble } from '../courses/guide';
import type { CreatedCourse } from '../courses/types';
import type { StudentProfile } from '../profile-storage';
import { programmingLearningMap as map } from './programming-data';
import { advanceDemo, getNodeState, getProgressStats, loadMapProgress, MAP_DEMO_MODE, saveMapProgress } from './progress';
import type { LearningNode, LearningWeek, MapProgress, NodeState } from './types';
import './learning-map.css';
import { FIRST_NODE_ID } from '../first-mission/content';

const statusLabels: Record<NodeState, string> = { locked: 'Bloqueado', unlocked: 'Desbloqueado', current: 'Actual · desbloqueado', completed: 'Completado' };
type SelectedNode = { week: LearningWeek; node: LearningNode; index: number };

export function MapGlyph({ name }: { name: 'lock' | 'check' | 'chest' | 'star' }) {
  return <svg className="map-glyph" viewBox="0 0 24 24" shapeRendering="crispEdges" aria-hidden="true">{name === 'lock' ? <><path d="M7 3h10v3h2v5h2v11H3V11h2V6h2Zm3 3v2H8v3h8V8h-2V6Z" fill="currentColor" fillRule="evenodd" /><path d="M11 14h2v5h-2Z" fill="#172b40" /></> : name === 'check' ? <path d="M3 11h4v4h3v-4h4V7h4V3h4v7h-4v4h-4v4h-4v4H6v-4H3Z" fill="currentColor" /> : name === 'chest' ? <><path d="M5 4h14v3h3v14H2V7h3Z" fill="#a35b27" /><path d="M5 4h14v3h3v6H2V7h3Z" fill="#ffbf50" /><path d="M2 13h20v3H2ZM6 5h3v15H6Zm9 0h3v15h-3Z" fill="#ffd977" /><path d="M10 11h4v7h-4Z" fill="#fff0ad" /><path d="M11 12h2v3h-2Z" fill="#754620" /></> : <path d="M10 1h4v6h7v4h-4v4h2v6h-5v-4h-4v4H5v-6h2v-4H3V7h7Z" fill="currentColor" />}</svg>;
}

type MapPageProps = { profile: StudentProfile; course?: CreatedCourse; onCourses: () => void; onPlayFirstMission: () => void; celebrateUnlock?: boolean; resumeNodeId?: string };
export function LearningMapPage({ profile, course, onCourses, onPlayFirstMission, celebrateUnlock, resumeNodeId }: MapPageProps) {
  if (!course || course.catalogId !== 'demo-programming-1') return <main className="course-shell map-empty-state"><Brand compact /><span className="course-kicker">MAPA DE APRENDIZAJE</span><h1>Elige tu aventura.</h1><p>Selecciona Programación I desde tus cursos para abrir su recorrido de 17 semanas.</p><button className="course-button" onClick={onCourses}>VOLVER A LOS CURSOS</button></main>;
  return <ProgrammingMap profile={profile} course={course} onCourses={onCourses} onPlayFirstMission={onPlayFirstMission} celebrateUnlock={celebrateUnlock} resumeNodeId={resumeNodeId} key={course.id} />;
}

function ProgrammingMap({ profile, course, onCourses, onPlayFirstMission, celebrateUnlock, resumeNodeId }: MapPageProps & { course: CreatedCourse }) {
  const { profile: currentProfile } = useStudentExperience();
  useEffect(() => { if (!resumeNodeId) return; const frame = requestAnimationFrame(() => { const node = document.getElementById(resumeNodeId); node?.scrollIntoView({ block: "center", behavior: "instant" }); node?.focus({ preventScroll: true }); }); return () => cancelAnimationFrame(frame); }, [resumeNodeId]);
  const [progress, setProgress] = useState(() => loadMapProgress(course.id, map));
  const stats = getProgressStats(map, progress);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(stats.currentNode?.id ?? null);
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [visibleWeek, setVisibleWeek] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia('(min-width: 960px)').matches);
  const [notice, setNotice] = useState('');
  const weeksRoot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = weeksRoot.current;
    if (!root) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setVisibleWeek(Number((visible[0].target as HTMLElement).dataset.week));
    }, { rootMargin: '-110px 0px -45% 0px', threshold: 0 });
    root.querySelectorAll<HTMLElement>('[data-week]').forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  function jumpToWeek(number: number, focusNode = false) {
    setVisibleWeek(number);
    const target = document.getElementById(`map-week-${number}`);
    target?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    if (focusNode && stats.currentNode) {
      setActiveNodeId(stats.currentNode.id);
      document.getElementById(stats.currentNode.id)?.focus({ preventScroll: true });
    } else target?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }

  function advance() {
    if (stats.completed === 0) return;
    const next = advanceDemo(map, progress, MAP_DEMO_MODE);
    const nextStats = getProgressStats(map, next);
    setProgress(next); setActiveNodeId(nextStats.currentNode?.id ?? null);
    const saved = saveMapProgress(course.id, map, next);
    setNotice(saved ? nextStats.finished ? 'Recorrido demo completado. No se ha otorgado XP.' : `Avance simulado guardado. Siguiente: ${nextStats.currentNode?.title}. No se otorga XP.` : 'Avance disponible durante esta sesión. No se pudo guardar en este navegador.');
  }

  const isExam = map.weeks[visibleWeek - 1]?.exam;
  const message = isExam ? '¡Se acerca un gran desafío! Repasa tus habilidades antes de continuar.' : '¡Tu aventura de Programación I está lista! Tenemos 17 semanas por conquistar. ¿Empezamos?';

  return <main className={`course-shell learning-map-shell tone-${profile.experience.messageTone} ${celebrateUnlock ? 'celebrate-unlock' : ''}`}>
    <header className="map-topbar"><button className="map-back" onClick={onCourses} aria-label="Volver a los cursos">← <span>MIS CURSOS</span></button><div className="map-header-course"><span className="course-kicker">TU MAPA DE APRENDIZAJE</span><strong>Programación I</strong></div><div className="map-header-progress"><div><span>{stats.completed} / {stats.total} niveles</span><b>{stats.percent}%</b></div><progress value={stats.completed} max={stats.total} aria-label="Progreso general del curso" /></div><span className="map-xp"><PixelIcon name="bolt" />{stats.xp} XP</span><StudentHeaderActions />{MAP_DEMO_MODE && <span className="demo-indicator"><i /> MODO DEMO</span>}</header>
    <div className="map-page-layout">
      <aside className="map-sidebar"><div className="map-course-card"><div className="map-course-emblem"><PixelIcon name="book" /></div><span className="course-kicker">CICLO 02 · {map.courseCode}</span><h1>Programación I</h1><p>{profile.answers.name}, cada paso abre un nuevo camino.</p><button className="course-button map-resume" onClick={() => jumpToWeek(stats.currentWeek, true)}>{stats.finished ? 'VER ÚLTIMA SEMANA' : 'IR A MI NIVEL'} <span>→</span></button></div>
        <details className="map-overview" open={sidebarOpen} onToggle={event => setSidebarOpen(event.currentTarget.open)}><summary>EXPLORA TU RUTA <span aria-hidden="true">⌄</span></summary><dl className="map-course-stats"><div><dt>Semana actual</dt><dd>{stats.currentWeek} / 17</dd></div><div><dt>Semanas completadas</dt><dd>{stats.completedWeeks} / 17</dd></div><div><dt>Progreso</dt><dd>{stats.percent}%</dd></div></dl><nav className="map-week-nav" aria-label="Acceso rápido a semanas">{map.weeks.map(week => <button key={week.id} onClick={() => jumpToWeek(week.number)} className={`${week.exam ? 'exam' : ''} ${week.number === visibleWeek ? 'viewing' : ''} ${week.number <= stats.completedWeeks ? 'done' : ''}`} aria-current={week.number === visibleWeek ? 'location' : undefined} aria-label={`Ver semana ${week.number}: ${week.title}${week.exam ? ', examen' : ''}`}>{String(week.number).padStart(2, '0')}</button>)}</nav><p className="map-nav-note">Puedes explorar todas las semanas. Ver una semana no desbloquea sus niveles.</p></details>
        <div className="map-state-legend"><span><i className="legend-current" /> Actual</span><span><i className="legend-unlocked" /> Disponible</span><span><i className="legend-completed" /> Completado</span><span><i className="legend-locked" /> Bloqueado</span></div>
        {MAP_DEMO_MODE && <section className="map-demo-controls" aria-label="Herramientas de demostración"><span>DESARROLLO · SIMULACIÓN</span><p>{stats.completed === 0 ? 'El primer subnivel se completa jugando los tres minijuegos. Después podrás avanzar los demás nodos en modo demo.' : 'Completa el siguiente nodo para probar el desbloqueo. No otorga XP.'}</p><button className="course-button secondary" disabled={stats.finished || stats.completed === 0} onClick={advance}>AVANZAR DEMO <span>→</span></button></section>}
      </aside>
      <div className="map-main"><section className={`map-guide-section ${isExam ? 'exam-guide' : ''}`} aria-label="Guía del mapa"><AcademicGuide /><DialogueBubble key={message} message={`${message} ${motivationMessage("map", currentProfile?.answers.tone ?? "friendly")}`} subtitle={isExam ? `Estás explorando la semana ${visibleWeek}. Los requisitos de desbloqueo siguen vigentes.` : 'Empieza por el nodo que dice JUGAR. Tu progreso se guarda en este navegador.'} /></section><p className="map-adaptation-note">17 semanas · 68 subniveles · Adaptación pedagógica de TriKUp a partir del sílabo de referencia. <span>Primer subnivel jugable · los demás, próximamente.</span></p>
        {celebrateUnlock && <div className="course-notice" role="status">¡Misión completada! El segundo subnivel está disponible y tu XP se ha registrado.</div>}
        {notice && <div className="course-notice map-progress-notice" role="status"><span>{notice}</span><button className="text-button" aria-label="Cerrar aviso" onClick={() => setNotice('')}>×</button></div>}
        <div className="learning-weeks" ref={weeksRoot}>{map.weeks.map(week => <WeekSection key={week.id} week={week} progress={progress} activeNodeId={activeNodeId} onSelect={selection => { if (selection.node.id === FIRST_NODE_ID) { onPlayFirstMission(); return; } setSelected(selection); if (getNodeState(map, progress, selection.node.id) !== 'locked') setActiveNodeId(selection.node.id); }} />)}</div>
        <footer className="map-end-marker"><MapGlyph name="star" /><h2>Un curso. Un camino. Tu siguiente nivel.</h2><p>{stats.finished ? 'Has completado la demostración del recorrido.' : 'Avanza paso a paso hasta la semana 17.'} Los demás desafíos se conectarán más adelante.</p><button className="text-button" onClick={onCourses}>← VOLVER A MIS CURSOS</button></footer>
      </div>
    </div>
    {selected && <NodePreparation selection={selected} state={getNodeState(map, progress, selected.node.id, activeNodeId)} currentTitle={stats.currentNode?.title} onClose={() => setSelected(null)} />}
  </main>;
}

export function WeekSection({ week, progress, activeNodeId, onSelect }: { week: LearningWeek; progress: MapProgress; activeNodeId: string | null; onSelect: (selection: SelectedNode) => void }) {
  const completedCount = week.nodes.filter(node => getNodeState(map, progress, node.id) === 'completed').length;
  const completed = completedCount === 4;
  return <section className={`map-week-section ${week.exam ? 'exam-week' : ''} ${completed ? 'week-completed' : ''}`} data-week={week.number} id={`map-week-${week.number}`} aria-labelledby={`map-week-title-${week.number}`}>
    <header className="map-week-header"><span className="map-week-number">{String(week.number).padStart(2, '0')}</span><div><span className="course-kicker">SEMANA {String(week.number).padStart(2, '0')}{week.exam ? ' · DESAFÍO DE EXAMEN' : ''}</span><h2 tabIndex={-1} id={`map-week-title-${week.number}`}>{week.title}</h2></div><span className="week-completion-count">{completed ? <><MapGlyph name="chest" /><span>COMPLETADA</span></> : `${completedCount} / 4`}</span></header>
    <div className="week-path"><svg className="week-path-lines" viewBox="0 0 280 464" preserveAspectRatio="none" aria-hidden="true">{[0, 1, 2].map(index => { const from = index % 2 === 0 ? 60 : 220; const to = index % 2 === 0 ? 220 : 60; const y = 58 + index * 116; const d = `M${from} ${y} V${y + 32} L${to} ${y + 84} V${y + 116}`; return <g key={index}><path d={d} className="path-base" /><path d={d} className={getNodeState(map, progress, week.nodes[index].id) === 'completed' ? 'path-completed' : 'path-pending'} /></g>; })}</svg>
      {week.nodes.map((node, index) => { const state = getNodeState(map, progress, node.id, activeNodeId); return <div className={`map-node-row ${index % 2 === 0 ? 'node-left' : 'node-right'}`} key={node.id}><div className="map-node-label"><span>SUBNIVEL {index + 1}</span><strong>{node.title}</strong><small>{statusLabels[state]}</small></div><div className="map-node-track"><button id={node.id} className={`map-node state-${state} ${week.exam ? 'exam-node' : ''}`} aria-label={`Semana ${week.number}, subnivel ${index + 1}: ${node.title}. ${statusLabels[state]}. ${state === 'locked' ? 'Ver requisitos' : 'Ver preparación'}.`} data-state={state} onClick={() => onSelect({ week, node, index })}><span className="map-node-face">{state === 'locked' ? <MapGlyph name="lock" /> : state === 'completed' ? <MapGlyph name="check" /> : <PixelIcon name={node.type === 'explore' ? 'book' : node.type === 'practice' ? 'puzzle' : node.type === 'apply' ? 'flag' : 'trophy'} />}</span>{state === 'current' && <span className="node-play-marker">JUGAR</span>}{state === 'completed' && <span className="node-stars" aria-hidden="true">✦<span>✦</span></span>}</button></div></div>; })}
    </div>
  </section>;
}

export function NodePreparation({ selection, state, currentTitle, onClose }: { selection: SelectedNode; state: NodeState; currentTitle?: string; onClose: () => void }) {
  const [started, setStarted] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef(document.activeElement);
  const { week, node, index } = selection;
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal(); return () => { if (trigger.current instanceof HTMLElement) trigger.current.focus({ preventScroll: true }); }; }, []);
  return <dialog className="node-preparation" ref={dialog} aria-labelledby="node-preparation-title" onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}><div className="node-preparation-inner"><button className="preparation-close" onClick={onClose} aria-label="Cerrar preparación">×</button><span className="course-kicker">SEMANA {String(week.number).padStart(2, '0')} · SUBNIVEL {index + 1}</span><div className={`preparation-emblem state-${state}`}>{state === 'locked' ? <MapGlyph name="lock" /> : <PixelIcon name={week.exam ? 'trophy' : 'compass'} />}</div><h2 id="node-preparation-title">{node.title}</h2>
    {started ? <div className="challenge-transition" data-node-id={node.id}><span className="course-kicker">PRÓXIMA MISIÓN</span><p>Este desafío estará disponible próximamente.</p><p className="preparation-footnote">Abrir esta pantalla no completa el nodo ni otorga XP.</p><button className="course-button" onClick={onClose}>VOLVER AL MAPA</button><button className="text-button" onClick={() => setStarted(false)}>← VOLVER A LA PREPARACIÓN</button></div> : <><div className="preparation-status">{statusLabels[state]}{week.exam && <span>DESAFÍO DE EXAMEN</span>}</div><h3>Tu objetivo</h3><p className="node-objective">{node.objective}</p><div className="expected-reward"><PixelIcon name="bolt" /><div><strong>+{node.expectedXp} XP previstos</strong><small>Recompensa futura al superar la actividad. No se otorga en esta demo.</small></div></div>{state === 'locked' && <p className="node-locked-reason">Completa los desafíos anteriores en orden. Tu siguiente paso es: <strong>{currentTitle ?? 'el primer subnivel'}</strong>.</p>}<button className="course-button" disabled={state === 'locked'} onClick={() => setStarted(true)}>COMENZAR DESAFÍO <span>→</span></button><p className="preparation-footnote">Modo demo · Sin minijuegos ni evaluación automática.</p></>}
  </div></dialog>;
}
