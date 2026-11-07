import { validateUpload } from './course-storage';

export type SyllabusResponse = {
  course_name: string;
  summary: string;
  units: { id: string; title: string; levels: { id: string; title: string; objectives: string[] }[] }[];
};

export const courseCreationMode = 'demo' as const;
type RealAnalysisOptions = { mode: 'real'; userApprovedUpload: true; apiBase: string; signal?: AbortSignal };

function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object'; }
function text(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0 && value.length <= 2000; }

export function parseSyllabusResponse(value: unknown): SyllabusResponse {
  if (!isRecord(value) || !text(value.course_name) || !text(value.summary) || !Array.isArray(value.units) || !value.units.length) throw new Error('Respuesta de análisis no válida.');
  const unitIds = new Set<string>();
  const levelIds = new Set<string>();
  for (const unit of value.units) {
    if (!isRecord(unit) || !text(unit.id) || unitIds.has(unit.id) || !text(unit.title) || !Array.isArray(unit.levels) || !unit.levels.length) throw new Error('Unidades del análisis no válidas.');
    unitIds.add(unit.id);
    for (const level of unit.levels) {
      if (!isRecord(level) || !text(level.id) || levelIds.has(level.id) || !text(level.title) || !Array.isArray(level.objectives) || !level.objectives.length || !level.objectives.every(text)) throw new Error('Niveles del análisis no válidos.');
      levelIds.add(level.id);
    }
  }
  return value as SyllabusResponse;
}

/** Future integration only. The demo UI never imports or invokes this function. */
export async function analyzeSyllabus(file: File, options: RealAnalysisOptions): Promise<SyllabusResponse> {
  if (options.mode !== 'real' || options.userApprovedUpload !== true) throw new Error('El análisis real requiere habilitación y envío explícitos.');
  const error = validateUpload(file, 'pdf');
  if (error) throw new Error(error);
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(`${options.apiBase.replace(/\/$/, '')}/api/syllabus/analyze`, {
    method: 'POST', body: form, signal: options.signal ?? AbortSignal.timeout(75000),
  });
  let result: unknown;
  try { result = await response.json(); } catch { throw new Error(`El servidor devolvió una respuesta no válida (HTTP ${response.status}).`); }
  if (!response.ok) {
    const message = isRecord(result) && isRecord(result.error) && typeof result.error.message === 'string' ? result.error.message : `No se pudo analizar el PDF (HTTP ${response.status}).`;
    throw new Error(message);
  }
  return parseSyllabusResponse(result);
}
