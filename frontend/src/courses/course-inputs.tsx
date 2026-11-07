import { useEffect, useId, useRef, useState } from 'react';
import { PixelIcon } from '../components/Brand';
import { careerOptions } from '../onboarding-data';
import { courseCatalog, filterCatalog } from './catalog';
import { validateUpload } from './course-storage';
import type { CatalogCourse, CourseDraft, CreationMethod } from './types';

type MethodDefinition = { id: CreationMethod; title: string; description: string; action: string; icon: 'cards' | 'spark' | 'book' };
export const creationMethods: MethodDefinition[] = [
  { id: 'pdf', title: 'TENGO MI SÍLABO', description: 'Sube el PDF de tu curso y prepara tu mapa de aprendizaje.', action: 'SUBIR PDF', icon: 'cards' },
  { id: 'image', title: 'TENGO UNA IMAGEN', description: 'Utiliza una foto o captura de tu sílabo.', action: 'SUBIR IMAGEN', icon: 'spark' },
  { id: 'catalog', title: 'QUIERO ELEGIR UN CURSO', description: 'Busca una asignatura según tu carrera y ciclo académico.', action: 'EXPLORAR CURSOS', icon: 'book' },
];

function MethodIcon({ method }: { method: CreationMethod }) {
  return <svg viewBox="0 0 32 32" fill="none" shapeRendering="crispEdges" aria-hidden="true">
    {method === 'pdf' ? <><path d="M8 3h12l6 6v20H6V3h2Z" fill="#153d67" stroke="currentColor" strokeWidth="2" /><path d="M20 3v7h6M11 14h10M11 19h10M11 24h6" stroke="currentColor" strokeWidth="2" /></>
      : method === 'image' ? <><path d="M3 6h26v22H3Z" fill="#153d67" stroke="currentColor" strokeWidth="2" /><path d="m5 25 8-10 5 6 4-4 5 8" fill="currentColor" /><path d="M21 10h4v4h-4Z" fill="#ffb347" /></>
        : <><path d="M3 5h10l3 3 3-3h10v23H19l-3 2-3-2H3Z" fill="#153d67" stroke="currentColor" strokeWidth="2" /><path d="M16 8v20M7 11h5M7 16h5M20 11h5M20 16h5" stroke="currentColor" strokeWidth="2" /></>}
  </svg>;
}

export function CreationMethodCard({ method, index, onSelect }: { method: MethodDefinition; index: number; onSelect: (method: CreationMethod) => void }) {
  return <button className={`creation-method method-${method.id}`} onClick={() => onSelect(method.id)}>
    <div className="method-card-top"><span className="method-index">0{index + 1}</span><span className="method-tag">{method.id === 'catalog' ? 'CATÁLOGO LOCAL' : 'TU MATERIAL'}</span></div>
    <div className="method-icon"><MethodIcon method={method.id} /></div>
    <h2>{method.title}</h2><p>{method.description}</p>
    <span className="method-action">{method.action}<b aria-hidden="true">→</b></span>
  </button>;
}

type UploaderProps = { kind: 'pdf' | 'image'; file: File | null; onFile: (file: File | null) => void; onContinue: () => void; onExplore: () => void };

export function FileUploader({ kind, file, onFile, onContinue, onExplore }: UploaderProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState('');
  const [previewError, setPreviewError] = useState(false);
  useEffect(() => {
    if (kind !== 'image' || !file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, kind]);

  function accept(files: FileList | null) {
    if (!files?.length) return;
    if (files.length !== 1) { setError('Selecciona un solo archivo a la vez.'); return; }
    const next = files[0];
    const problem = validateUpload(next, kind);
    setError(problem ?? '');
    if (!problem) { setPreviewError(false); onFile(next); }
    if (input.current) input.current.value = '';
  }

  return <section className="course-panel upload-panel" aria-label={kind === 'pdf' ? 'Cargar PDF' : 'Cargar imagen'}>
    <div className="panel-heading"><div><span className="course-kicker">INVENTARIO DE MATERIAL</span><h2>{kind === 'pdf' ? 'Tu sílabo, tu punto de partida.' : 'Una imagen abre el camino.'}</h2></div><span className="limit-chip">MÁX. 5 MiB</span></div>
    <input className="visually-hidden" ref={input} id={id} type="file" accept={kind === 'pdf' ? '.pdf,application/pdf' : '.png,.jpg,.jpeg,image/png,image/jpeg'} onChange={e => accept(e.target.files)} />
    <div className={`upload-drop ${dragging ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files); }}>
      {kind === 'image' && file && preview && !previewError ? <img className="upload-preview" src={preview} alt={`Vista previa de ${file.name}`} onError={() => { setPreviewError(true); setError('No se puede visualizar esta imagen. Reemplázala por un PNG o JPEG válido.'); }} /> : <div className="upload-glyph"><MethodIcon method={kind} /></div>}
      <strong>{file ? file.name : 'Arrastra tu archivo hasta aquí'}</strong>
      <span>{file ? `${(file.size / 1024).toFixed(1)} KiB · ${file.type}` : kind === 'pdf' ? 'PDF · hasta 5 MiB' : 'PNG, JPG o JPEG · hasta 5 MiB'}</span>
      <button className="course-button secondary" onClick={() => input.current?.click()}>{file ? 'REEMPLAZAR ARCHIVO' : 'SELECCIONAR ARCHIVO'}</button>
      {file && <button className="text-button" onClick={() => { onFile(null); setError(''); setPreviewError(false); }}>Eliminar archivo</button>}
    </div>
    {error && <p className="course-error" role="alert">{error}</p>}
    <div className="honest-notice"><PixelIcon name="light" /><div><strong>{kind === 'pdf' ? 'Simulación de carga · mapa precargado de Programación I' : file ? 'Archivo cargado. El análisis automático no está disponible en este modo.' : 'Tu material se queda contigo.'}</strong><p>{kind === 'image' ? 'La imagen debe ser legible. No se realiza OCR. Puedes elegir un curso del catálogo o registrar su nombre.' : 'Cualquier PDF admitido abre la misma demo de 17 semanas. No se analiza el contenido ni se envía el documento.'} El archivo permanece en memoria y se perderá al recargar.</p></div></div>
    <div className="course-actions"><button className="text-button" onClick={onExplore}>Explorar contenido de ejemplo →</button><button className="course-button" disabled={!file || previewError} onClick={onContinue}>REVISAR SELECCIÓN <span>→</span></button></div>
  </section>;
}

export function PdfUploader(props: Omit<UploaderProps, 'kind'>) { return <FileUploader {...props} kind="pdf" />; }
export function ImageUploader(props: Omit<UploaderProps, 'kind'>) { return <FileUploader {...props} kind="image" />; }

export function CourseSearch({ initialCareer, initialCycle, allowCustom, onSelect }: { initialCareer: string; initialCycle: string; allowCustom: boolean; onSelect: (draft: Pick<CourseDraft, 'name' | 'career' | 'cycle' | 'catalogId'>) => void }) {
  const [career, setCareer] = useState(initialCareer);
  const [cycle, setCycle] = useState(initialCycle);
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = courseCatalog.find(course => course.id === selectedId);
  const results = filterCatalog(query, career, cycle);
  const careers = [...new Set([initialCareer, ...careerOptions.filter(c => c !== 'Otra'), ...courseCatalog.map(c => c.career)])];
  const cycles = [...new Set([initialCycle, ...Array.from({ length: 10 }, (_, i) => String(i + 1))])];
  const clearSelection = () => { setSelectedId(null); setCustom(''); };
  return <section className="course-panel catalog-panel" aria-label="Explorar catálogo">
    <div className="panel-heading"><div><span className="course-kicker">ENCUENTRA TU SIGUIENTE RETO</span><h2>Elige una aventura académica.</h2></div><span className="limit-chip">CATÁLOGO DEMO</span></div>
    <div className="catalog-filters">
      <label>Tu carrera<select value={career} onChange={e => { setCareer(e.target.value); clearSelection(); }}><option value="">Todas las carreras</option>{careers.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Ciclo de referencia<select value={cycle} onChange={e => { setCycle(e.target.value); clearSelection(); }}><option value="">Todos los ciclos</option>{cycles.map(value => <option key={value} value={value}>{/^\d+$/.test(value) ? `Ciclo ${value}` : value}</option>)}</select></label>
      <label className="course-search-label">Buscar curso<div className="course-search-input"><PixelIcon name="compass" /><input type="search" placeholder="Ej. Programación" value={query} onChange={e => { setQuery(e.target.value); setSelectedId(null); }} /></div></label>
    </div>
    <p className="catalog-disclaimer">Cursos de ejemplo. Los ciclos son agrupaciones ficticias de esta demo; no representan el plan de estudios de ninguna universidad.</p>
    <CourseCatalog courses={results} selectedId={selectedId} onSelect={course => { setSelectedId(course.id); setCustom(''); }} />
    {results.length === 0 && <div className="catalog-empty"><PixelIcon name="compass" /><h3>Esta ruta aún no tiene cursos.</h3><p>Prueba con otros filtros{allowCustom ? ' o escribe el nombre de tu curso abajo' : ' para elegir un curso precargado'}.</p><button className="course-button secondary" onClick={() => { setCareer(''); setCycle(''); setQuery(''); clearSelection(); }}>VER TODO EL CATÁLOGO</button></div>}
    {allowCustom && <div className="custom-course"><label htmlFor="custom-course">¿Tu curso no está aquí? Ponle nombre.</label><input id="custom-course" maxLength={100} placeholder="Nombre de tu curso" value={custom} onChange={e => { setCustom(e.target.value); setSelectedId(null); }} /><small>Se creará sin temas ni semanas hasta que añadas contenido en una próxima versión.</small></div>}
    {(selected || custom.trim()) && <div className="selected-course" role="status"><PixelIcon name="flag" /><div><span>AVENTURA SELECCIONADA</span><strong>{selected?.name ?? custom.trim()}</strong><small>{selected?.map ? `Demo de ${selected.map.weeks.length} semanas · ${selected.map.weeks.length * 4} subniveles` : selected ? 'Solo temas de referencia disponibles' : 'Curso personalizado · contenido pendiente'}</small></div></div>}
    <div className="course-actions"><span className="muted-small">Programación I tiene el recorrido demo completo.</span><button className="course-button" disabled={!selected && !custom.trim()} onClick={() => onSelect({ name: selected?.name ?? custom.trim(), career: career || selected?.career || initialCareer, cycle: cycle || selected?.demoCycle || initialCycle, catalogId: selected?.id })}>ELEGIR AVENTURA <span>→</span></button></div>
  </section>;
}

export function CourseCatalog({ courses, selectedId, onSelect }: { courses: CatalogCourse[]; selectedId: string | null; onSelect: (course: CatalogCourse) => void }) {
  return <div className="course-results" aria-label="Cursos disponibles">{courses.map(course => <button className={`catalog-course ${selectedId === course.id ? 'selected' : ''}`} aria-pressed={selectedId === course.id} key={course.id} onClick={() => onSelect(course)}><div className="catalog-course-icon"><PixelIcon name="book" /></div><div><span className={`content-chip ${course.map ? 'ready' : ''}`}>{course.map ? `${course.map.weeks.length} SEMANAS DEMO` : 'TEMAS DE EJEMPLO'}</span><h3>{course.name}</h3><p>{course.description}</p><small>{course.career} · Ciclo demo {course.demoCycle}</small></div><span className="course-radio" aria-hidden="true">{selectedId === course.id ? '✓' : ''}</span></button>)}</div>;
}
