import { gameDefinitions, memoryCards, rainQuestions, type GameId } from '../first-mission/content';
import { initialMission, reduceMission, gameScore, type GameStats, type MissionSession } from '../first-mission/engine';
import { validTimestamp } from './dates';
import { announceStudentData } from './local-events';

export type TopicId = 'class' | 'object' | 'attribute' | 'method' | 'code-structure';
export const TOPIC_LABELS: Record<TopicId, string> = { class: 'Clases', object: 'Objetos', attribute: 'Atributos', method: 'Métodos', 'code-structure': 'Organización de clases en C#' };
export type Observation = { topic: TopicId; correct: boolean };
export type ActivityResult = { id: string; courseId: string; runId: string; nodeId: 'pi17-w01-n1'; week: 1; sublevel: 1; game: GameId; completedAt: string | null; stats: GameStats; observations: Observation[] };
export const ACTIVITY_STORAGE_KEY = 'trikup-activities-v1';

export function activitiesFromSession(courseId: string, session: MissionSession): ActivityResult[] {
  const observations: Record<GameId, Observation[]> = { memory: [], rain: [], builder: [] };
  let state = initialMission(session.builderOrder);
  for (const action of session.journal) {
    const next = reduceMission(state, action);
    if (next.memory.stats.attempts > state.memory.stats.attempts) {
      const card = memoryCards.find(c => c.id === next.memory.open[0]);
      if (card) observations.memory.push({ topic: card.concept, correct: !!next.memory.feedback?.correct });
    }
    if (next.rain.stats.attempts > state.rain.stats.attempts) observations.rain.push({ topic: rainQuestions[state.rain.questionIndex].answer, correct: !!next.rain.feedback?.correct });
    if (next.builder.stats.attempts > state.builder.stats.attempts) observations.builder.push({ topic: 'code-structure', correct: !!next.builder.feedback?.correct });
    state = next;
  }
  return gameDefinitions.filter(game => state[game.id].stats.completed).map(game => ({ id: `${encodeURIComponent(courseId)}:${session.runId}:${game.id}`, courseId, runId: session.runId, nodeId: 'pi17-w01-n1', week: 1, sublevel: 1, game: game.id, completedAt: session.completedAt[game.id] ?? null, stats: { ...state[game.id].stats }, observations: observations[game.id] }));
}
export function loadActivities(): ActivityResult[] {
  try {
    const raw = JSON.parse(localStorage.getItem(ACTIVITY_STORAGE_KEY) ?? 'null');
    if (raw?.version !== 1 || !Array.isArray(raw.activities)) return [];
    const result = new Map<string, ActivityResult>();
    for (const value of raw.activities.slice(0, 10000)) {
      if (!value || typeof value.id !== 'string' || typeof value.courseId !== 'string' || typeof value.runId !== 'string' || value.id !== `${encodeURIComponent(value.courseId)}:${value.runId}:${value.game}` || !gameDefinitions.some(g => g.id === value.game)) continue;
      const stats = value.stats;
      if (!stats || stats.completed !== true || ![stats.attempts, stats.mistakes, stats.hintsUsed].every(n => Number.isSafeInteger(n) && n >= 0) || stats.attempts < 1 || stats.mistakes >= stats.attempts || stats.xp !== gameScore(value.game, stats.mistakes, stats.hintsUsed)) continue;
      if (value.completedAt !== null && !validTimestamp(value.completedAt)) continue;
      const observations = Array.isArray(value.observations) ? value.observations.filter((o: Observation) => o && Object.hasOwn(TOPIC_LABELS, o.topic) && typeof o.correct === 'boolean') : [];
      result.set(value.id, { id: value.id, courseId: value.courseId, runId: value.runId, game: value.game, nodeId: 'pi17-w01-n1', week: 1, sublevel: 1, completedAt: value.completedAt, stats: { ...stats }, observations });
    }
    return [...result.values()];
  } catch { return []; }
}
export function syncSessionActivities(courseId: string, session: MissionSession): boolean {
  const existing = loadActivities();
  const fresh = activitiesFromSession(courseId, session).filter(item => !existing.some(saved => saved.id === item.id && saved.courseId === item.courseId));
  if (!fresh.length) return true;
  try { localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify({ version: 1, activities: [...existing, ...fresh] })); announceStudentData(); return true; } catch { return false; }
}
