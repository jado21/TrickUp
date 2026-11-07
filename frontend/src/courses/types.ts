export type CreationMethod = 'pdf' | 'image' | 'catalog';
export type SublevelKind = 'DISCOVER' | 'PRACTICE' | 'APPLY' | 'PROVE';

export type DemoSublevel = {
  kind: SublevelKind;
  title: string;
  activity: string;
};

export type DemoWeek = {
  id: string;
  title: string;
  topics: string[];
  objectives: string[];
  sublevels: [DemoSublevel, DemoSublevel, DemoSublevel, DemoSublevel];
};

export type DemoMap = {
  courseName: string;
  notice: string;
  weeks: DemoWeek[];
  references: { title: string; url: string }[];
};

export type CatalogCourse = {
  id: string;
  name: string;
  career: string;
  /** Fictional grouping for this demo; never an official curriculum assignment. */
  demoCycle: string;
  description: string;
  topics: string[];
  map?: DemoMap;
};

export type FileMetadata = { name: string; size: number; type: string };

export type CourseDraft = {
  name: string;
  career: string;
  cycle: string;
  method: CreationMethod;
  catalogId?: string;
  file?: FileMetadata;
};

export type CreatedCourse = CourseDraft & {
  id: string;
  createdAt: string;
  source: 'catalog-demo' | 'manual-empty';
  status: 'demo-ready' | 'topics-only' | 'pending-content';
  topics: string[];
  map?: DemoMap;
  progress: { completedSublevels: string[]; xp: number };
};

export const METHOD_LABELS: Record<CreationMethod, string> = {
  pdf: 'Sílabo PDF',
  image: 'Imagen del sílabo',
  catalog: 'Catálogo o nombre personalizado',
};

export const SUBLEVEL_LABELS: Record<SublevelKind, string> = {
  DISCOVER: 'DESCUBRIR',
  PRACTICE: 'PRACTICAR',
  APPLY: 'APLICAR',
  PROVE: 'DEMOSTRAR',
};
