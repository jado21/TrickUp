import { beforeEach, describe, expect, it, vi } from 'vitest';
import { courseCatalog, filterCatalog, programmingDemo } from './catalog';
import { createLocalCourse, loadCourses, loadSelectedCourse, pdfDemoDraft, saveCourse, validateUpload, MAX_UPLOAD_BYTES } from './course-storage';
import { analyzeSyllabus, parseSyllabusResponse } from './syllabus-adapter';
import type { CourseDraft } from './types';

const draft: CourseDraft = { name: 'Programación I', career: 'Ingeniería de Sistemas', cycle: '5', method: 'catalog', catalogId: 'demo-programming-1' };
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network access'); }));
});

describe('course catalog and demo content', () => {
  it('searches without case or accents, with independent career and cycle filters', () => {
    expect(filterCatalog('PROGRAMACION', '', '')).toHaveLength(2);
    expect(filterCatalog('programación', 'Ingeniería de Sistemas', '2').map(c => c.id)).toEqual(['demo-programming-1', 'demo-programming-2']);
    expect(filterCatalog('', 'Psicología', '1')).toHaveLength(1);
    expect(filterCatalog('', 'Medicina', '10')).toEqual([]);
    expect(filterCatalog('', 'Ingeniería de Sistemas', '5').map(c => c.name)).toEqual(['Redes de Computadoras', 'Ingeniería de Software']);
  });
  it('provides seventeen weeks with exactly four named sublevels and objectives', () => {
    expect(programmingDemo.weeks).toHaveLength(17);
    for (const week of programmingDemo.weeks) {
      expect(week.objectives.length).toBeGreaterThan(0);
      expect(week.topics.length).toBeGreaterThan(0);
      expect(week.sublevels.map(s => s.kind)).toEqual(['DISCOVER', 'PRACTICE', 'APPLY', 'PROVE']);
      expect(week.sublevels.every(s => s.activity.length > 40)).toBe(true);
    }
    expect(new Set(courseCatalog.map(c => c.id)).size).toBe(courseCatalog.length);
  });
  it('never invents weeks for courses that only have topic lists', () => {
    const result = createLocalCourse({ ...draft, name: 'Base de Datos', catalogId: 'demo-databases' });
    expect(result.map).toBeUndefined();
    expect(result.status).toBe('topics-only');
    expect(result.topics).toEqual(['Modelo relacional', 'Claves', 'Consultas SQL']);
  });
});

describe('uploads', () => {
  it('validates PDF MIME, extension, empty file and maximum size', () => {
    expect(validateUpload({ name: 'syllabus.pdf', type: 'application/pdf', size: MAX_UPLOAD_BYTES }, 'pdf')).toBeNull();
    for (const file of [{ name: 'bad.txt', type: 'application/pdf', size: 1 }, { name: 'bad.pdf', type: 'text/plain', size: 1 }, { name: 'bad.pdf', type: 'application/pdf', size: 0 }, { name: 'big.pdf', type: 'application/pdf', size: MAX_UPLOAD_BYTES + 1 }]) expect(validateUpload(file, 'pdf')).not.toBeNull();
  });
  it('allows only PNG and JPEG images within limits', () => {
    expect(validateUpload({ name: 'PHOTO.JPEG', type: 'image/jpeg', size: 100 }, 'image')).toBeNull();
    expect(validateUpload({ name: 'a.png', type: 'image/png', size: 100 }, 'image')).toBeNull();
    expect(validateUpload({ name: 'a.svg', type: 'image/svg+xml', size: 100 }, 'image')).not.toBeNull();
    expect(validateUpload({ name: 'a.png', type: 'image/jpeg', size: 100 }, 'image')).not.toBeNull();
  });
  it('prevents arbitrary PDF creation without explicitly chosen catalog content', () => {
    expect(() => createLocalCourse({ ...draft, method: 'pdf', catalogId: undefined })).toThrow('no se ha analizado');
    const course = createLocalCourse({ ...draft, method: 'pdf', file: { name: 'syllabus.pdf', size: 100, type: 'application/pdf' } });
    expect(course.source).toBe('catalog-demo');
    expect(course.map?.courseName).toBe('Programación I');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('explicitly associates any accepted PDF with the same seventeen-week demo preset', () => {
    for (const name of ['mi-silabo.pdf', 'otro-curso.pdf']) {
      const result = createLocalCourse(pdfDemoDraft({ name, size: 100, type: 'application/pdf' }, 'Ingeniería Informática'));
      expect(result.name).toBe('Programación I');
      expect(result.cycle).toBe('2');
      expect(result.map?.weeks).toHaveLength(17);
      expect(result.file?.name).toBe(name);
      expect(result.source).toBe('catalog-demo');
    }
    expect(() => pdfDemoDraft({ name: 'bad.txt', type: 'text/plain', size: 100 }, 'Sistemas')).toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('local persistence', () => {
  it('persists source, selection, initial progress and the deterministic demo map', () => {
    const result = saveCourse(draft);
    expect(result.persisted).toBe(true);
    expect(loadSelectedCourse()?.id).toBe(result.course.id);
    expect(loadCourses()[0].map).toEqual(programmingDemo);
    expect(loadCourses()[0].progress).toEqual({ completedSublevels: [], xp: 0 });
    expect(loadCourses()[0].cycle).toBe('5');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('deduplicates catalog and normalized custom courses without erasing progress', () => {
    const first = saveCourse(draft);
    first.course.progress = { completedSublevels: ['variables:DISCOVER'], xp: 10 };
    localStorage.setItem('trikup-courses-v1', JSON.stringify(first.courses));
    const repeated = saveCourse({ ...draft, method: 'pdf' });
    expect(repeated.duplicate).toBe(true);
    expect(repeated.courses).toHaveLength(1);
    expect(repeated.course.progress.xp).toBe(10);
    const custom = { ...draft, catalogId: undefined, name: '  Estadística  ' };
    saveCourse(custom);
    expect(saveCourse({ ...custom, name: 'ESTADISTICA' }).duplicate).toBe(true);
  });
  it('stores image metadata without file bytes or fabricated content', () => {
    const course = saveCourse({ ...draft, method: 'image', catalogId: undefined, name: 'Mi curso', file: { name: 'capture.png', type: 'image/png', size: 200 } }).course;
    expect(course.source).toBe('manual-empty');
    expect(course.map).toBeUndefined();
    expect(course.topics).toEqual([]);
    expect(course.status).toBe('pending-content');
    expect(loadCourses()[0].file).toEqual(course.file);
    expect(localStorage.getItem('trikup-courses-v1')).not.toContain('data:');
  });
  it('handles corruption, bad entries and unavailable storage', () => {
    localStorage.setItem('trikup-courses-v1', 'not-json');
    expect(loadCourses()).toEqual([]);
    localStorage.setItem('trikup-courses-v1', JSON.stringify([null, {}, { ...draft, catalogId: 'unknown' }, createLocalCourse(draft)]));
    expect(loadCourses()).toHaveLength(1);
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error(); }, setItem: () => { throw new Error(); } });
    expect(loadCourses()).toEqual([]);
    const result = saveCourse(draft);
    expect(result.persisted).toBe(false);
    expect(result.courses).toHaveLength(1);
  });
});

describe('future syllabus adapter', () => {
  const response = { course_name: 'Cálculo I', summary: 'Límites y derivadas.', units: [{ id: 'u1', title: 'Límites', levels: [{ id: 'l1', title: 'Concepto de límite', objectives: ['Interpretar límites.'] }] }] };
  it('validates the actual snake_case contract and rejects malformed responses', () => {
    expect(parseSyllabusResponse(response)).toEqual(response);
    expect(() => parseSyllabusResponse({ ...response, units: [] })).toThrow();
    expect(() => parseSyllabusResponse({ ...response, units: [{ ...response.units[0], levels: [] }] })).toThrow();
  });
  it('has no network activity unless called with an explicitly enabled real mode', async () => {
    await expect(analyzeSyllabus(new File(['pdf'], 'test.pdf', { type: 'application/pdf' }), { mode: 'demo', userApprovedUpload: false, apiBase: '' } as unknown as Parameters<typeof analyzeSyllabus>[1])).rejects.toThrow('habilitación');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('builds one multipart request without forcing a boundary or retrying', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
    vi.stubGlobal('fetch', request);
    const file = new File(['%PDF-1.4'], 'test.pdf', { type: 'application/pdf' });
    const result = await analyzeSyllabus(file, { mode: 'real', userApprovedUpload: true, apiBase: 'http://localhost:8000/' });
    expect(result).toEqual(response);
    expect(request).toHaveBeenCalledTimes(1);
    const [url, options] = request.mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/syllabus/analyze');
    expect(options.body.get('file').name).toBe('test.pdf');
    expect(options.headers).toBeUndefined();
  });
  it('reports server errors and never falls back silently to demo content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 422, json: async () => ({ error: { code: 'VALIDATION_ERROR', message: 'PDF sin texto.' } }) }));
    await expect(analyzeSyllabus(new File(['pdf'], 'test.pdf', { type: 'application/pdf' }), { mode: 'real', userApprovedUpload: true, apiBase: 'http://localhost:8000' })).rejects.toThrow('PDF sin texto.');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
