import { expectedCodeOrder, memoryCards, FIRST_NODE_ID } from './content';
import { applyAction, createMissionSession, initialMission, isMissionAction, missionCompleted, missionXp, type MissionSession } from './engine';
import { programmingLearningMap as map } from '../learning-map/programming-data';
import { completeFromMission, loadMapProgress, saveMapProgress } from '../learning-map/progress';
import { validTimestamp } from '../student/dates';
import { syncSessionActivities } from '../student/activity-service';
import { announceStudentData } from '../student/local-events';

const key = (courseId: string) => `trikup-poo-mission-v1:${encodeURIComponent(courseId)}`;
const permutation = (value: unknown, expected: readonly string[]): value is string[] => Array.isArray(value) && value.length === expected.length && new Set(value).size === expected.length && value.every(id => typeof id === 'string' && expected.includes(id));

export function loadMission(courseId: string): MissionSession {
  try {
    const raw = JSON.parse(localStorage.getItem(key(courseId)) ?? 'null');
    if (raw?.version !== 1 || !permutation(raw.memoryOrder, memoryCards.map(card => card.id)) || !permutation(raw.builderOrder, expectedCodeOrder) || !Array.isArray(raw.journal) || raw.journal.length > 10000 || !raw.journal.every(isMissionAction)) return createMissionSession();
    let hash = 2166136261;
    for (const char of JSON.stringify([raw.memoryOrder, raw.builderOrder, raw.journal])) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    const runId = typeof raw.runId === 'string' && raw.runId.length <= 100 ? raw.runId : `legacy-${(hash >>> 0).toString(16)}`;
    let session: MissionSession = { version: 1, runId, startedAt: null, updatedAt: null, completedAt: {}, memoryOrder: raw.memoryOrder, builderOrder: raw.builderOrder as MissionSession['builderOrder'], journal: [], state: initialMission(raw.builderOrder as MissionSession['builderOrder']) };
    for (const action of raw.journal) session = applyAction(session, action, null);
    session.startedAt = validTimestamp(raw.startedAt) ? raw.startedAt : null;
    session.updatedAt = validTimestamp(raw.updatedAt) ? raw.updatedAt : null;
    for (const game of ['memory', 'rain', 'builder'] as const) if (session.state[game].stats.completed && validTimestamp(raw.completedAt?.[game])) session.completedAt[game] = raw.completedAt[game];
    return session;
  } catch { return createMissionSession(); }
}
export function saveMission(courseId: string, session: MissionSession): boolean {
  try {
    localStorage.setItem(key(courseId), JSON.stringify({ version: 1, runId: session.runId, startedAt: session.startedAt, updatedAt: session.updatedAt, completedAt: session.completedAt, memoryOrder: session.memoryOrder, builderOrder: session.builderOrder, journal: session.journal }));
    const saved = syncSessionActivities(courseId, session);
    announceStudentData();
    return saved;
  } catch { return false; }
}

/** No reward is read from localStorage snapshots: grading is replayed from valid actions. */
export function commitMission(courseId: string, session: MissionSession) {
  const before = loadMapProgress(courseId, map);
  if (!missionCompleted(session.state)) return { progress: before, persisted: false, completed: false, awardedXp: 0 };
  const previous = before.completions.find(entry => entry.nodeId === FIRST_NODE_ID);
  const progress = completeFromMission(map, before, FIRST_NODE_ID, missionXp(session.state), { runId: session.runId, completedAt: session.updatedAt ?? undefined });
  return { progress, persisted: saveMapProgress(courseId, map, progress), completed: true, awardedXp: previous?.source === 'mission' ? 0 : missionXp(session.state) };
}
