import { announceStudentData } from "../student/local-events";
import { validTimestamp } from "../student/dates";
import type { LearningMap, LearningNode, MapProgress, NodeState } from './types';

export const MAP_DEMO_MODE = true;
export const allNodes = (map: LearningMap): LearningNode[] => map.weeks.flatMap(week => week.nodes);
export const initialProgress = (map: LearningMap): MapProgress => ({ mapId: map.id, mapVersion: map.version, completions: [] });

/** Accept only a contiguous, valid prefix. Old four-week demos are a separate version. */
export function normalizeProgress(map: LearningMap, value: unknown): MapProgress {
  const result = initialProgress(map);
  if (!value || typeof value !== 'object') return result;
  const raw = value as Record<string, unknown>;
  if (raw.mapId !== map.id || raw.mapVersion !== map.version || !Array.isArray(raw.completions)) return result;
  const nodes = allNodes(map);
  for (let i = 0; i < Math.min(raw.completions.length, nodes.length); i++) {
    const entry = raw.completions[i];
    if (!entry || typeof entry !== 'object' || entry.nodeId !== nodes[i].id || !['demo', 'mission'].includes(entry.source) || !Number.isSafeInteger(entry.xp) || entry.xp < 0) break;
    result.completions.push({ nodeId: entry.nodeId, source: entry.source, xp: entry.source === 'demo' ? 0 : entry.xp, ...(entry.source === 'mission' && typeof entry.runId === 'string' ? { runId: entry.runId } : {}), ...(entry.source === 'mission' && validTimestamp(entry.completedAt) ? { completedAt: entry.completedAt } : {}) });
  }
  return result;
}

export function getProgressStats(map: LearningMap, progress: MapProgress) {
  const normalized = normalizeProgress(map, progress);
  const nodes = allNodes(map);
  const completed = normalized.completions.length;
  const current = nodes[completed];
  return { completed, total: nodes.length, percent: Math.round(completed / nodes.length * 100), completedWeeks: Math.floor(completed / 4), currentWeek: current ? Math.floor(completed / 4) + 1 : map.weeks.length, currentNode: current, xp: normalized.completions.reduce((sum, entry) => sum + entry.xp, 0), finished: completed === nodes.length };
}

export function getNodeState(map: LearningMap, progress: MapProgress, nodeId: string, activeNodeId?: string | null): NodeState {
  const stats = getProgressStats(map, progress);
  const index = allNodes(map).findIndex(node => node.id === nodeId);
  if (index < 0 || index > stats.completed) return 'locked';
  if (index < stats.completed) return 'completed';
  return activeNodeId === undefined || activeNodeId === nodeId ? 'current' : 'unlocked';
}

function completeNextNode(map: LearningMap, progress: MapProgress, nodeId: string, source: 'demo' | 'mission', xp: number, metadata: { runId?: string; completedAt?: string } = {}): MapProgress {
  const normalized = normalizeProgress(map, progress);
  const previous = normalized.completions.find(entry => entry.nodeId === nodeId);
  if (previous) {
    if (source === 'mission' && previous.source === 'demo') {
      if (!Number.isSafeInteger(xp) || xp < 0) throw new Error('La recompensa de XP no es válida.');
      return { ...normalized, completions: normalized.completions.map(entry => entry.nodeId === nodeId ? { nodeId, source, xp, ...metadata } : entry) };
    }
    return normalized;
  }
  const next = getProgressStats(map, normalized).currentNode;
  if (!next || next.id !== nodeId) throw new Error('Completa primero el desafío anterior.');
  if (!Number.isSafeInteger(xp) || xp < 0) throw new Error('La recompensa de XP no es válida.');
  return { ...normalized, completions: [...normalized.completions, { nodeId, source, xp: source === 'demo' ? 0 : xp, ...(source === 'mission' ? metadata : {}) }] };
}

/** Development control only: completion is simulated and never awards XP. */
export function advanceDemo(map: LearningMap, progress: MapProgress, demoMode: boolean): MapProgress {
  if (!demoMode) throw new Error('Avanzar demo solo está disponible en modo demostración.');
  const next = getProgressStats(map, progress).currentNode;
  return next ? completeNextNode(map, progress, next.id, 'demo', 0) : normalizeProgress(map, progress);
}

/** Future mission-engine integration point; not invoked by opening or starting a node. */
export function completeFromMission(map: LearningMap, progress: MapProgress, nodeId: string, awardedXp: number, metadata: { runId?: string; completedAt?: string } = {}): MapProgress {
  return completeNextNode(map, progress, nodeId, 'mission', awardedXp, metadata);
}

const storageKey = (courseId: string, map: LearningMap) => `trikup-map-v1:${map.id}:${encodeURIComponent(courseId)}`;
export function loadMapProgress(courseId: string, map: LearningMap): MapProgress {
  try { return normalizeProgress(map, JSON.parse(localStorage.getItem(storageKey(courseId, map)) ?? 'null')); } catch { return initialProgress(map); }
}
export function saveMapProgress(courseId: string, map: LearningMap, progress: MapProgress): boolean {
  try { const value = JSON.stringify(normalizeProgress(map, progress)); const key = storageKey(courseId, map); const changed = localStorage.getItem(key) !== value; localStorage.setItem(key, value); if (changed) announceStudentData(); return true; } catch { return false; }
}
