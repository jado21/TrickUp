import { useEffect, useRef, useState } from 'react';
import { initialAnswers } from '../onboarding-data';
import { useStudentExperience } from './StudentExperience';
import { calculateStreak } from './streak-service';
import { formatDate, localDay, shiftDay } from './dates';
import { motivationMessage } from './motivation-engine';
import { MAP_DEMO_MODE } from '../learning-map/progress';

export function DemoControls() {
  const experience = useStudentExperience();
  const [offset, setOffset] = useState(0);
  const [previewDays, setPreviewDays] = useState<string[]>([]);
  const [previewType, setPreviewType] = useState<'reminder' | 'success' | 'unlock' | 'streak' | 'review' | 'reward' | 'return'>('reminder');
  const [resetOpen, setResetOpen] = useState(false);
  const [notice, setNotice] = useState('');
  if (!MAP_DEMO_MODE) return null;
  const previewDay = shiftDay(localDay(), offset);
  const preview = calculateStreak([...experience.snapshot.activeDays, ...previewDays], previewDay);
  return <details className="student-demo-tools"><summary>HERRAMIENTAS DEMO · DESARROLLO <span>⌄</span></summary><div className="demo-tools-inner"><p>Estos controles están separados de tu aprendizaje. Las vistas previas no cambian el reloj del sistema, la XP, la racha real ni las notificaciones guardadas.</p><div className="demo-control-buttons"><button className="course-button secondary" onClick={() => setResetOpen(true)}>REINICIAR PROGRESO</button><button className="course-button secondary" onClick={() => { const saved = experience.savePreferences({ ...initialAnswers, name: 'Alex', career: 'Ingeniería de Sistemas', cycle: '2', goal: 'pass_courses', motivation: 'personal_records', difficulty: 'guided', games: ['MEMORY_MATCH', 'ORDER_SEQUENCE'], time: 'short', tone: 'friendly' }, { ...experience.appearance, demoProfile: true }); setNotice(saved ? 'Perfil demo aplicado. Se conservaron los cursos y resultados existentes; no se generaron actividades.' : 'Perfil demo aplicado durante esta sesión.'); }}>RESTAURAR PERFIL DEMO</button><button className="text-button" onClick={() => document.getElementById('student-achievements')?.scrollIntoView({ block: 'start' })}>CONSULTAR RECOMPENSAS ↑</button></div>
    <section className="demo-preview-sandbox"><span className="course-kicker">VISTA PREVIA AISLADA · NO REGISTRA ACTIVIDAD REAL</span><h3>Regreso el {formatDate(previewDay)}</h3><p>{motivationMessage(offset >= 2 ? 'return' : 'reminder', experience.profile?.answers.tone ?? 'friendly')}</p><div className="demo-preview-stats"><span>Racha en esta vista: <strong>{preview.current}</strong></span><span>Mejor racha en esta vista: <strong>{preview.best}</strong></span><span>Objetivo siguiente: <strong>{preview.nextGoal}</strong></span></div><div className="demo-control-buttons"><button className="course-button secondary" onClick={() => setOffset(value => value + 1)}>SIMULAR DÍA SIGUIENTE</button><button className="course-button secondary" onClick={() => setPreviewDays(days => [...new Set([...days, previewDay])])}>SIMULAR ACTIVIDAD SOLO AQUÍ</button><button className="text-button" onClick={() => { setOffset(0); setPreviewDays([]); }}>REINICIAR VISTA PREVIA</button></div><small>Los días simulados solo viven en esta vista. No aparecen en el historial real ni desbloquean insignias reales.</small></section>
    <section className="demo-notification-preview"><label>Vista previa de aviso<select value={previewType} onChange={e => setPreviewType(e.target.value as typeof previewType)}><option value="reminder">Recordatorio</option><option value="success">Felicitación</option><option value="unlock">Nuevo nivel</option><option value="streak">Racha</option><option value="review">Repaso</option><option value="reward">Recompensa</option><option value="return">Regreso</option></select></label><p role="status">{motivationMessage(previewType, experience.profile?.answers.tone ?? 'friendly')}</p><small>Solo es una vista previa: no crea avisos ni modifica el contador de la campana.</small></section>{notice && <p className="course-notice" role="status">{notice}</p>}</div>
    {resetOpen && <ResetProgressDialog onClose={() => setResetOpen(false)} onConfirm={() => { setNotice(experience.resetProgress() ? 'Progreso reiniciado. Se conservaron el perfil y los cursos.' : 'No se pudo reiniciar completamente el almacenamiento.'); setOffset(0); setPreviewDays([]); setResetOpen(false); }} />}
  </details>;
}

function ResetProgressDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef(document.activeElement);
  useEffect(() => { if (!dialog.current?.open) dialog.current?.showModal(); return () => { if (trigger.current instanceof HTMLElement) trigger.current.focus(); }; }, []);
  return <dialog ref={dialog} className="student-reset-dialog" aria-labelledby="reset-title" onCancel={event => { event.preventDefault(); onClose(); }}><span className="course-kicker">CONTROL DE DESARROLLO</span><h2 id="reset-title">Reiniciar tu progreso local</h2><p>Se borrarán los resultados de juegos, avances del mapa, XP, rachas, logros y notificaciones de este navegador. Se conservarán tu perfil y tus cursos.</p><p>Esta acción no se puede deshacer.</p><div className="demo-control-buttons"><button className="course-button secondary" onClick={onClose}>CANCELAR</button><button className="course-button" onClick={onConfirm}>BORRAR PROGRESO LOCAL</button></div></dialog>;
}
