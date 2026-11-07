import { useEffect, useRef, useState } from 'react';
import { useStudentExperience } from './StudentExperience';
import { formatDate } from './dates';
import { notificationText } from './notification-service';

export function StudentIcon({ name }: { name: 'bell' | 'settings' | 'home' | 'streak' | 'badge' }) {
  const paths = { bell: 'M9 2h6v3h3v3h2v10h3v3H1v-3h3V8h2V5h3Zm1 20h4v2h-4Z', settings: 'M9 1h6v4h4v4h4v6h-4v4h-4v4H9v-4H5v-4H1V9h4V5h4Zm1 7v2H8v4h2v2h4v-2h2v-4h-2V8Z', home: 'M10 2h4v3h4v4h4v3h-3v10h-5v-7h-4v7H5V12H2V9h4V5h4Z', streak: 'M12 1h3v5h3v4h3v8h-3v4H7v-3H3v-9h4V6h3v7h3v-3h-1Z', badge: 'M8 1h8v3h4v4h3v8h-4v3h-3v4h-4v-4H8v4H4v-7H1V8h3V4h4Zm2 6v3H7v4h3v3h4v-3h3v-4h-3V7Z' };
  return <svg className="student-icon" viewBox="0 0 24 24" shapeRendering="crispEdges" aria-hidden="true"><path d={paths[name]} fill="currentColor" fillRule="evenodd" /></svg>;
}
export function StudentHeaderActions() {
  const experience = useStudentExperience();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const bell = useRef<HTMLButtonElement>(null);
  const unread = experience.engagement.notifications.filter(item => !item.readAt).length;
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); bell.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <div className="student-header-actions" ref={root}><button className="student-icon-button" title="Mi panel" aria-label="Ir a mi panel" onClick={experience.onDashboard}><StudentIcon name="home" /></button><button className="student-icon-button notification-bell" title="Notificaciones" ref={bell} aria-label={`Notificaciones, ${unread} sin leer`} aria-expanded={open} aria-controls="student-notifications" onClick={() => setOpen(value => !value)}><StudentIcon name="bell" />{unread > 0 && <span>{unread > 99 ? '99+' : unread}</span>}</button><button className="student-icon-button" title="Configuración" aria-label="Configurar perfil y preferencias" onClick={experience.onSettings}><StudentIcon name="settings" /></button>
    {open && <section className="notification-center" id="student-notifications" aria-label="Centro de notificaciones"><header><div><span className="course-kicker">TU BUZÓN DE AVENTURA</span><h2>Notificaciones</h2></div><button className="text-button" onClick={() => experience.markRead()}>LEER TODAS</button></header><p className="notification-scope">Avisos dentro de TriKUp. No se envían al cerrar la web.</p><div className="notification-list">{experience.engagement.notifications.length ? experience.engagement.notifications.slice(0, 40).map(item => <article key={item.id} className={item.readAt ? 'read' : 'unread'}><StudentIcon name={item.type === 'reward' ? 'badge' : item.type === 'streak' ? 'streak' : 'bell'} /><div><small>{formatDate(item.createdAt)} · {item.readAt ? 'LEÍDA' : 'NUEVA'}</small>{item.detail && <strong>{item.detail}</strong>}<p>{notificationText(item, experience.profile?.answers.tone ?? 'friendly')}</p><div><button className="text-button" onClick={() => experience.markRead(item.id)} disabled={!!item.readAt}>{item.readAt ? 'LEÍDA' : 'MARCAR LEÍDA'}</button>{item.courseId && <button className="text-button" onClick={() => { const course = experience.snapshot.courses.find(c => c.course.id === item.courseId); experience.markRead(item.id); setOpen(false); if (course) experience.onCourse(course.course, course.stats?.currentNode?.id); }}>VER CURSO →</button>}</div></div></article>) : <div className="notifications-empty"><StudentIcon name="bell" /><p>Aquí aparecerán los avisos de tu aventura.</p></div>}</div></section>}
  </div>;
}
