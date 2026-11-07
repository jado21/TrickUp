import { courseCatalog, normalizeSearch } from './catalog';
import type { CourseDraft, CreatedCourse, FileMetadata } from './types';

const STORAGE_KEY = 'trikup-courses-v1';
const SELECTED_KEY = 'trikup-selected-course-v1';
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Explicit simulation: any accepted PDF uses this preset, never its extracted contents. */
export function pdfDemoDraft(file: FileMetadata, career: string): CourseDraft {
  const error = validateUpload(file, 'pdf');
  if (error) throw new Error(error);
  return { name: 'Programación I', career, cycle: '2', method: 'pdf', catalogId: 'demo-programming-1', file: { name: file.name, size: file.size, type: file.type } };
}

export function validateUpload(file: FileMetadata, kind: 'pdf' | 'image'): string | null {
  if (file.size === 0) return 'El archivo está vacío. Selecciona otro.';
  if (file.size > MAX_UPLOAD_BYTES) return 'El tamaño máximo es 5 MiB.';
  const extension = file.name.split('.').pop()?.toLowerCase();
  const valid = kind === 'pdf'
    ? extension === 'pdf' && file.type === 'application/pdf'
    : ((extension === 'png' && file.type === 'image/png') || (['jpg', 'jpeg'].includes(extension ?? '') && file.type === 'image/jpeg'));
  return valid ? null : kind === 'pdf' ? 'Selecciona un PDF de tipo application/pdf.' : 'Selecciona una imagen PNG, JPG o JPEG.';
}

export function courseIdentity(draft: CourseDraft): string {
  return `${draft.catalogId ?? `custom:${normalizeSearch(draft.name)}`}|${normalizeSearch(draft.career)}|${normalizeSearch(draft.cycle)}`;
}

export function createLocalCourse(draft: CourseDraft): CreatedCourse {
  if (!draft.name.trim() || draft.name.trim().length > 100 || !draft.career.trim() || !draft.cycle.trim()) throw new Error('Completa los datos del curso.');
  const catalog = draft.catalogId ? courseCatalog.find(course => course.id === draft.catalogId) : undefined;
  if (draft.catalogId && !catalog) throw new Error('El curso ya no está disponible en el catálogo.');
  if (draft.method === 'pdf' && !catalog) throw new Error('El PDF no se ha analizado. Elige un curso precargado para continuar.');
  if (draft.file && validateUpload(draft.file, draft.method === 'pdf' ? 'pdf' : 'image')) throw new Error('El archivo no cumple los límites de carga.');
  return {
    ...draft, name: catalog?.name ?? draft.name.trim(), career: draft.career.trim(), cycle: draft.cycle.trim(),
    id: courseIdentity(draft), createdAt: new Date().toISOString(),
    source: catalog ? 'catalog-demo' : 'manual-empty',
    status: catalog?.map ? 'demo-ready' : catalog ? 'topics-only' : 'pending-content',
    topics: catalog?.topics ?? [], map: catalog?.map,
    progress: { completedSublevels: [], xp: 0 },
  };
}

/** Only bounded metadata is restored. Maps come from our trusted local catalog. */
export function loadCourses(): CreatedCourse[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    const result = new Map<string, CreatedCourse>();
    for (const item of raw.slice(0, 100)) {
      if (!item || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;
      if (typeof r.name !== 'string' || typeof r.career !== 'string' || typeof r.cycle !== 'string' || !['pdf', 'image', 'catalog'].includes(String(r.method))) continue;
      if (r.catalogId !== undefined && typeof r.catalogId !== 'string') continue;
      if (r.career.length > 120 || r.cycle.length > 50) continue;
      try {
        const draft: CourseDraft = { name: r.name, career: r.career, cycle: r.cycle, method: r.method as CourseDraft['method'], catalogId: r.catalogId as string | undefined };
        if (r.file && typeof r.file === 'object') {
          const file = r.file as Record<string, unknown>;
          if (typeof file.name === 'string' && typeof file.size === 'number' && typeof file.type === 'string' && file.name.length <= 255) draft.file = { name: file.name, size: file.size, type: file.type };
        }
        const course = createLocalCourse(draft);
        if (typeof r.createdAt === 'string' && !Number.isNaN(Date.parse(r.createdAt))) course.createdAt = r.createdAt;
        const progress = r.progress as CreatedCourse['progress'] | undefined;
        if (progress && Array.isArray(progress.completedSublevels)) {
          const validIds = new Set(course.map?.weeks.flatMap(w => w.sublevels.map(s => `${w.id}:${s.kind}`)) ?? []);
          course.progress.completedSublevels = [...new Set(progress.completedSublevels.filter(id => typeof id === 'string' && validIds.has(id)))];
          if (Number.isSafeInteger(progress.xp) && progress.xp >= 0) course.progress.xp = progress.xp;
        }
        if (!result.has(course.id)) result.set(course.id, course);
      } catch { /* Ignore stale or malformed entries individually. */ }
    }
    return [...result.values()];
  } catch { return []; }
}

export type SaveCourseResult = { course: CreatedCourse; courses: CreatedCourse[]; duplicate: boolean; persisted: boolean };

export function saveCourse(draft: CourseDraft, current = loadCourses()): SaveCourseResult {
  const candidate = createLocalCourse(draft);
  const existing = current.find(course => course.id === candidate.id);
  const course = existing ?? candidate;
  const courses = existing ? current : [...current, course];
  let persisted = false;
  try {
    // Never store the file itself, data URLs or binary content.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
    localStorage.setItem(SELECTED_KEY, course.id);
    persisted = true;
  } catch { /* Caller retains in-memory data and shows a clear notice. */ }
  return { course, courses, duplicate: !!existing, persisted };
}

export function loadSelectedCourse(courses = loadCourses()): CreatedCourse | undefined {
  try { return courses.find(course => course.id === localStorage.getItem(SELECTED_KEY)); } catch { return undefined; }
}

export function selectCourse(id: string): boolean {
  try { localStorage.setItem(SELECTED_KEY, id); return true; } catch { return false; }
}
