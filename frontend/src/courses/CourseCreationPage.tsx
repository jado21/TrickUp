import { StudentHeaderActions } from "../student/StudentHeaderActions";
import { useStudentExperience } from "../student/StudentExperience";
import { useEffect, useRef, useState } from 'react';
import { Brand, PixelIcon } from '../components/Brand';
import type { StudentProfile } from '../profile-storage';
import { courseCatalog } from './catalog';
import { loadCourses, loadSelectedCourse, pdfDemoDraft, saveCourse, selectCourse } from './course-storage';
import { AcademicGuide, CourseCreationAnimation, DialogueBubble } from './guide';
import { CourseSearch, CreationMethodCard, ImageUploader, PdfUploader, creationMethods } from './course-inputs';
import { METHOD_LABELS, SUBLEVEL_LABELS, type CourseDraft, type CreatedCourse, type CreationMethod } from './types';
import './courses.css';

type Scene = 'methods' | 'upload' | 'processing' | 'catalog' | 'confirm' | 'created';

function PdfDemoProcessing({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const completed = useRef(false);
  const latestComplete = useRef(onComplete);
  latestComplete.current = onComplete;
  const finish = () => { if (!completed.current) { completed.current = true; latestComplete.current(); } };
  useEffect(() => {
    const timer = window.setTimeout(() => { if (!completed.current) { completed.current = true; latestComplete.current(); } }, 1600);
    return () => window.clearTimeout(timer);
  }, []);
  return <section className="course-panel pdf-demo-processing" aria-label="Procesamiento simulado"><CourseCreationAnimation /><span className="course-kicker">MODO DEMOSTRACIÓN · PROCESO SIMULADO</span><h2>Preparando Programación I</h2><p>Se cargará el mismo mapa precargado de 17 semanas para cualquier PDF admitido. El contenido de tu archivo no se está analizando.</p><div className="pdf-processing-bar" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <span key={index} style={{ '--segment': index } as React.CSSProperties} />)}</div><button className="course-button" onClick={finish}>ABRIR MAPA DEMO <span>→</span></button><button className="text-button processing-cancel" onClick={onCancel}>CANCELAR Y CAMBIAR ARCHIVO</button></section>;
}

export function CourseCreationPage({ profile, onProfile, onOpenMap, initialCourse }: { profile: StudentProfile; onProfile: () => void; onOpenMap: (course: CreatedCourse) => void; initialCourse?: CreatedCourse }) {
  const { answers, experience } = profile;
  const { snapshot } = useStudentExperience();
  const career = answers.career === 'Otra' ? answers.otherCareer : answers.career;
  const cycle = answers.cycle === 'Otro' ? answers.otherCycle : answers.cycle;
  const [scene, setScene] = useState<Scene>(initialCourse ? 'created' : 'methods');
  const [method, setMethod] = useState<CreationMethod>('catalog');
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<CourseDraft | null>(null);
  const [chosenContent, setChosenContent] = useState(false);
  const [courses, setCourses] = useState(loadCourses);
  const [activeCourse, setActiveCourse] = useState(() => initialCourse ?? loadSelectedCourse());
  const [notice, setNotice] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const initialScene = useRef(true);

  useEffect(() => {
    if (initialScene.current) { initialScene.current = false; return; }
    heading.current?.focus();
    heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [scene]);

  const fileInfo = file ? { name: file.name, size: file.size, type: file.type } : undefined;
  const titles: Record<Scene, string> = { methods: 'Una nueva aventura te espera.', upload: method === 'pdf' ? 'Trae el mapa de tu curso.' : 'Dale forma a tu próxima aventura.', processing: 'Abriendo tu mapa de demostración.', catalog: '¿Qué curso conquistamos hoy?', confirm: '¡NUEVA AVENTURA DETECTADA!', created: '¡MISIÓN ACEPTADA!' };
  const initialMessage = `¡Hey, ${answers.name}! Soy tu guía académico. ¿Qué curso vamos a conquistar hoy?`;
  const message = scene === 'created' ? '¡Misión aceptada! Tu próxima aventura está por comenzar.'
    : scene === 'confirm' ? chosenContent ? `¡${answers.name}, esta aventura lleva tu nombre! Revisa tu selección y abramos el portal.` : 'Tu archivo está listo para revisar. Elige contenido del catálogo para preparar la aventura; todavía no hemos analizado tu material.'
      : scene === 'catalog' ? `¡${answers.name}! Preparé algunas opciones para ${career}. Puedes explorar cursos de tu ciclo o buscar cualquier otro.`
        : scene === 'upload' ? method === 'pdf' ? '¡Excelente! Con tu sílabo podremos organizar las semanas de tu aventura.' : '¡Una foto también puede ser el inicio de una gran aventura!'
          : initialMessage;
  const subtitle = scene === 'methods' ? 'Puedes traer tu propio material o elegir un curso para comenzar.'
    : scene === 'upload' ? 'En esta demo guardamos la selección, sin analizar ni enviar tu archivo.'
      : scene === 'created' ? experience.visibleHints ? 'Iremos paso a paso. Los objetivos y las pistas del recorrido están a tu alcance.' : experience.emphasizeRecords ? 'Tu primer desafío: conocer los objetivos de esta aventura.' : 'Explora el contenido disponible a tu ritmo.'
        : 'Tú eliges el rumbo. Siempre puedes volver y cambiar de selección.';

  function chooseMethod(next: CreationMethod) {
    setMethod(next); setFile(null); setDraft(null); setChosenContent(false); setNotice('');
    setScene(next === 'catalog' ? 'catalog' : 'upload');
  }

  function reviewFile() {
    if (!file) return;
    setDraft({ name: file.name.replace(/\.[^.]+$/, '').slice(0, 100), career, cycle, method, file: fileInfo });
    setChosenContent(false); setScene('confirm');
  }

  function createAdventure(openMap = false) {
    if (!draft || !chosenContent) return;
    try {
      const result = saveCourse(draft, courses);
      setCourses(result.courses); setActiveCourse(result.course); setScene('created');
      setNotice(!result.persisted ? 'No se pudo guardar en este navegador. Tu aventura está disponible durante esta sesión.' : result.duplicate ? 'Ya tenías esta aventura. Recuperamos el curso guardado sin duplicarlo ni reiniciar su progreso.' : 'Aventura guardada en este navegador.');
      if (openMap || result.course.catalogId === 'demo-programming-1') onOpenMap(result.course);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'No se pudo crear la aventura.'); }
  }

  function back() {
    setNotice('');
    if (scene === 'confirm') setScene(chosenContent ? 'catalog' : 'upload');
    else if (scene === 'catalog' && method !== 'catalog') setScene('upload');
    else { setScene('methods'); setFile(null); setDraft(null); setChosenContent(false); }
  }

  return <main className={`course-shell tone-${experience.messageTone}`}>
    <header className="topbar course-topbar"><button className="logo-button" onClick={onProfile} aria-label="Ver mi perfil"><Brand compact /></button><div className="course-header-trail"><span>MI AVENTURA</span><b aria-hidden="true">/</b><strong>CREAR CURSO</strong></div><StudentHeaderActions /><span className="demo-indicator"><i /> MODO DEMO · LOCAL</span></header>
    <div className="course-container">
      <div className="course-page-top"><button className="text-button" onClick={scene === 'methods' ? onProfile : back}>← {scene === 'methods' ? 'MI PERFIL' : scene === 'created' ? 'CREAR OTRA AVENTURA' : 'VOLVER'}</button><div className="student-context"><PixelIcon name="compass" /><span>{career}</span><b>·</b><span>{/^\d+$/.test(cycle) ? `Ciclo ${cycle}` : cycle}</span></div></div>
      <div className="course-title-row"><div><span className="course-kicker">EL COMIENZO DE TU SIGUIENTE NIVEL</span><h1 ref={heading} tabIndex={-1}>{titles[scene]}</h1></div><div className="course-stage-count"><span>{scene === 'methods' ? '01' : scene === 'confirm' ? '03' : scene === 'created' ? '04' : '02'}</span> / 04</div></div>
      <section className="guide-scene" aria-label="Guía académico"><div className="guide-platform"><div className="scene-orbit" /><i className="scene-star star-one" /><i className="scene-star star-two" /><AcademicGuide celebrating={scene === 'created'} /><div className="platform-top" /></div><DialogueBubble key={message} message={message} subtitle={subtitle} /></section>
      {notice && <div className="course-notice" role="status"><PixelIcon name="flag" /><span>{notice}</span><button className="text-button" onClick={() => setNotice('')} aria-label="Cerrar aviso">×</button></div>}
      <div className="course-scene-content" key={`${scene}-${method}`}>
        {scene === 'methods' && <><div className="method-grid">{creationMethods.map((item, index) => <CreationMethodCard method={item} index={index} onSelect={chooseMethod} key={item.id} />)}</div><p className="course-mode-footnote"><span className="tiny-square" /> Sin cuenta conectada · sin IA · tus archivos no se envían</p></>}
        {scene === 'upload' && (method === 'pdf' ? <PdfUploader file={file} onFile={next => { setFile(next); if (next) { setDraft(pdfDemoDraft(next, career)); setChosenContent(true); setScene('processing'); } }} onContinue={reviewFile} onExplore={() => setScene('catalog')} /> : <ImageUploader file={file} onFile={setFile} onContinue={reviewFile} onExplore={() => setScene('catalog')} />)}
        {scene === 'processing' && <PdfDemoProcessing onComplete={() => createAdventure(true)} onCancel={() => { setFile(null); setDraft(null); setChosenContent(false); setScene('upload'); }} />}
        {scene === 'catalog' && <CourseSearch initialCareer={draft?.career ?? career} initialCycle={draft?.cycle ?? cycle} allowCustom={method !== 'pdf'} onSelect={selection => { setDraft({ ...selection, method, file: fileInfo }); setChosenContent(true); setScene('confirm'); }} />}
        {scene === 'confirm' && draft && <CourseConfirmation draft={draft} canCreate={chosenContent} onBack={back} onCreate={() => createAdventure()} onCatalog={() => setScene('catalog')} />}
        {scene === 'created' && activeCourse && <CreatedAdventure course={activeCourse} onOpenMap={() => onOpenMap(activeCourse)} onAnother={() => { setScene('methods'); setFile(null); setDraft(null); setChosenContent(false); setNotice(''); }} />}
      </div>
      {courses.length > 0 && scene === 'methods' && <section className="saved-adventures"><div className="panel-heading"><div><span className="course-kicker">TU INVENTARIO</span><h2>Aventuras guardadas <span>({courses.length})</span></h2></div></div><div className="saved-course-list">{courses.map(course => <button className="saved-course" key={course.id} onClick={() => { if (!selectCourse(course.id)) setNotice('No se pudo guardar la selección; puedes explorar el curso durante esta sesión.'); setActiveCourse(course); if (course.catalogId === 'demo-programming-1') onOpenMap(course); else setScene('created'); }}><PixelIcon name="book" /><div><strong>{course.name}</strong><small>{course.career} · {course.status === 'demo-ready' ? 'Demo disponible' : 'Contenido parcial o pendiente'}</small></div><span>{course.id === activeCourse?.id ? 'RETOMAR' : 'ABRIR'} →</span></button>)}</div></section>}
      <footer className="course-footer"><span>TRIKUP <b>×</b> kAIzen</span><span>TU APRENDIZAJE. TU AVENTURA.</span><span>NIVEL {snapshot.level} <i /> {snapshot.totalXp} XP</span></footer>
    </div>
  </main>;
}

export function CourseConfirmation({ draft, canCreate, onBack, onCreate, onCatalog }: { draft: CourseDraft; canCreate: boolean; onBack: () => void; onCreate: () => void; onCatalog: () => void }) {
  const catalog = courseCatalog.find(course => course.id === draft.catalogId);
  return <section className="course-panel confirmation-panel" aria-label="Confirmar aventura"><div className="confirmation-icon"><PixelIcon name="flag" /></div><span className="course-kicker">REVISA TU EQUIPAMIENTO</span><h2>{canCreate ? draft.name : 'Material cargado · curso pendiente'}</h2><dl className="confirmation-facts"><div><dt>CARRERA</dt><dd>{draft.career}</dd></div><div><dt>CICLO SELECCIONADO</dt><dd>{draft.cycle}</dd></div><div><dt>MÉTODO DE CREACIÓN</dt><dd>{METHOD_LABELS[draft.method]}</dd></div><div><dt>CONTENIDO DISPONIBLE</dt><dd>{!canCreate ? 'Sin análisis automático' : catalog?.map ? `${catalog.map.weeks.length} semanas demo · ${catalog.map.weeks.length * 4} subniveles` : catalog ? 'Solo temas de ejemplo · sin semanas' : 'Nombre registrado · sin contenido'}</dd></div>{draft.file && <div className="full-width"><dt>ARCHIVO SELECCIONADO</dt><dd>{draft.file.name} · {(draft.file.size / 1024).toFixed(1)} KiB <small>Solo en memoria. No se conservará al recargar.</small></dd></div>}</dl>
    <div className="honest-notice"><PixelIcon name="light" /><p>{!canCreate ? 'Archivo cargado. El análisis automático no está disponible en este modo. Elige un curso precargado para continuar.' : catalog ? 'El contenido procede del catálogo demostrativo local. No fue extraído de tu archivo ni generado por Gemini.' : 'Se guardará el nombre de tu curso con contenido pendiente. No se han creado semanas ni extraído texto.'}</p></div>
    {!canCreate && <button className="course-button secondary" onClick={onCatalog}>{draft.method === 'image' ? 'ELEGIR O NOMBRAR UN CURSO' : 'ELEGIR CURSO PRECARGADO'} →</button>}
    <div className="course-actions"><button className="text-button" onClick={onBack}>← CAMBIAR SELECCIÓN</button><button className="course-button" disabled={!canCreate} onClick={onCreate}>CREAR MI AVENTURA <span>→</span></button></div>
  </section>;
}

function CreatedAdventure({ course, onAnother, onOpenMap }: { course: CreatedCourse; onAnother: () => void; onOpenMap: () => void }) {
  return <section className="created-adventure"><div className="unlocked-header"><CourseCreationAnimation /><div><span className="course-kicker">NUEVA RUTA DESBLOQUEADA</span><h2>{course.name}</h2><p>{course.map ? 'Tu recorrido de ejemplo está listo para explorar.' : course.topics.length ? 'Tu curso está registrado con temas de referencia.' : 'Tu curso está registrado. El contenido sigue pendiente.'}</p><span className="content-chip ready">{course.map ? 'RECORRIDO DEMO' : 'REGISTRO LOCAL'} · 0 XP INICIAL</span></div></div>
    {course.catalogId === "demo-programming-1" && <button className="course-button map-open-action" onClick={onOpenMap}>ABRIR MAPA DE APRENDIZAJE</button>}
    <div className="course-panel course-content-preview"><div className="panel-heading"><div><span className="course-kicker">VISTA PREVIA DEL CONTENIDO</span><h3>{course.map ? `${course.map.weeks.length} semanas · cuatro formas de aprender` : 'Lo que está disponible'}</h3></div><span className="limit-chip">DEMO DETERMINISTA</span></div>
      <p className="catalog-disclaimer">{course.map?.notice ?? 'Este registro no contiene un mapa académico completo. No se generaron actividades ni semanas.'}</p>
      {course.map ? <><div className="demo-week-list">{course.map.weeks.map((week, i) => <details className="demo-week" key={week.id}><summary><span className="week-number">{String(i + 1).padStart(2, '0')}</span><div><small>SEMANA {i + 1} · DEMOSTRACIÓN</small><strong>{week.title}</strong></div><span className="week-expand" aria-hidden="true">+</span></summary><div className="week-detail"><p><strong>Temas:</strong> {week.topics.join(' · ')}</p><h4>Objetivos</h4><ul>{week.objectives.map(objective => <li key={objective}>{objective}</li>)}</ul><div className="sublevel-list">{week.sublevels.map(sublevel => <article key={sublevel.kind}><span>{SUBLEVEL_LABELS[sublevel.kind]}</span><p>{sublevel.activity}</p></article>)}</div></div></details>)}</div><div className="demo-references"><strong>Referencias del contenido:</strong>{course.map.references.map(reference => <a href={reference.url} target="_blank" rel="noreferrer" key={reference.url}>{reference.title} ↗</a>)}</div></>
        : course.topics.length > 0 ? <ul className="topic-list">{course.topics.map(topic => <li key={topic}>{topic}</li>)}</ul> : <p>Podrás añadir material cuando la integración de contenido esté disponible.</p>}
      {course.file && <p className="file-memory-note">Archivo de origen: {course.file.name}. Solo se conserva su nombre, tamaño y tipo; el archivo no se guarda ni se analiza.</p>}
      <div className="course-actions"><span className="muted-small">Sin minijuegos ni evaluación en esta vista previa.</span><button className="course-button" onClick={onAnother}>CREAR OTRA AVENTURA <span>+</span></button></div>
    </div>
  </section>;
}

