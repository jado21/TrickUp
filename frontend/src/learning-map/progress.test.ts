import { beforeEach, describe, expect, it, vi } from 'vitest';
import { programmingLearningMap as map } from './programming-data';
import { advanceDemo, allNodes, completeFromMission, getNodeState, getProgressStats, initialProgress, loadMapProgress, normalizeProgress, saveMapProgress } from './progress';
import { resolveScreen, routeFor } from '../navigation';

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No network expected'); }));
});

describe('Programación I map', () => {
  it('contains the supplied seventeen-week outline, second cycle, and 68 unique nodes', () => {
    expect(map.cycle).toBe('2');
    expect(map.courseCode).toBe('II0206');
    expect(map.weeks).toHaveLength(17);
    expect(map.weeks.map(week => week.number)).toEqual(Array.from({ length: 17 }, (_, i) => i + 1));
    expect(map.weeks.filter(week => week.exam).map(week => week.number)).toEqual([8, 16, 17]);
    expect(allNodes(map)).toHaveLength(68);
    expect(new Set(allNodes(map).map(node => node.id)).size).toBe(68);
    expect(allNodes(map).every(node => node.objective.length > 30 && node.expectedXp > 0)).toBe(true);
    expect(map.weeks[0].nodes.map(n => n.title)).toEqual(['Introducción a POO', 'Componentes y organización del computador', 'Lenguajes de programación y sistemas operativos', 'Desafío de fundamentos']);
    expect(map.weeks[12].title).toBe('Consolidación de archivos');
    expect(map.notice).toContain('adaptaciones pedagógicas');
  });
  it('initially unlocks only the first node and exposes current, available, locked and completed states', () => {
    const progress = initialProgress(map);
    const nodes = allNodes(map);
    expect(getNodeState(map, progress, nodes[0].id)).toBe('current');
    expect(getNodeState(map, progress, nodes[0].id, null)).toBe('unlocked');
    expect(nodes.slice(1).every(node => getNodeState(map, progress, node.id) === 'locked')).toBe(true);
    expect(getNodeState(map, progress, 'unknown')).toBe('locked');
    expect(getNodeState(map, advanceDemo(map, progress, true), nodes[0].id)).toBe('completed');
  });
  it('advances one node at a time, unlocks the next week and awards no demo XP', () => {
    let progress = initialProgress(map);
    for (let i = 0; i < 4; i++) progress = advanceDemo(map, progress, true);
    const stats = getProgressStats(map, progress);
    expect(stats.completed).toBe(4);
    expect(stats.completedWeeks).toBe(1);
    expect(stats.currentWeek).toBe(2);
    expect(stats.currentNode?.id).toBe(map.weeks[1].nodes[0].id);
    expect(stats.xp).toBe(0);
    expect(progress.completions.every(entry => entry.source === 'demo' && entry.xp === 0)).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('disables the development control outside demo mode', () => {
    expect(() => advanceDemo(map, initialProgress(map), false)).toThrow('modo demostración');
  });
  it('can finish all 68 nodes without overrun and keeps 100 percent after another demo advance', () => {
    let progress = initialProgress(map);
    for (let i = 0; i < 70; i++) progress = advanceDemo(map, progress, true);
    expect(getProgressStats(map, progress)).toMatchObject({ completed: 68, total: 68, percent: 100, completedWeeks: 17, currentWeek: 17, xp: 0, finished: true });
    expect(getProgressStats(map, progress).currentNode).toBeUndefined();
  });
});

describe('future mission progress', () => {
  it('accepts only sequential completions, validates XP and is idempotent', () => {
    const empty = initialProgress(map);
    const firstId = map.weeks[0].nodes[0].id;
    expect(() => completeFromMission(map, empty, map.weeks[0].nodes[1].id, 20)).toThrow('anterior');
    expect(() => completeFromMission(map, empty, firstId, -1)).toThrow('XP');
    expect(() => completeFromMission(map, empty, firstId, NaN)).toThrow('XP');
    const completed = completeFromMission(map, empty, firstId, 10);
    expect(getProgressStats(map, completed).xp).toBe(10);
    expect(getProgressStats(map, completeFromMission(map, completed, firstId, 100)).xp).toBe(10);
    expect(empty.completions).toEqual([]);
  });
});

describe('local map persistence', () => {
  it('restores a saved prefix for its course and keeps other courses independent', () => {
    const progress = advanceDemo(map, initialProgress(map), true);
    expect(saveMapProgress('course-a', map, progress)).toBe(true);
    expect(loadMapProgress('course-a', map)).toEqual(progress);
    expect(loadMapProgress('course-b', map)).toEqual(initialProgress(map));
  });
  it('rejects incompatible old maps, out-of-order entries and fabricated demo XP', () => {
    const firstId = map.weeks[0].nodes[0].id;
    const first = { nodeId: firstId, source: 'demo', xp: 100 };
    expect(normalizeProgress(map, { mapId: 'old-python-map', mapVersion: 1, completions: [first] }).completions).toEqual([]);
    expect(normalizeProgress(map, { ...initialProgress(map), mapVersion: 0, completions: [first] }).completions).toEqual([]);
    expect(normalizeProgress(map, { ...initialProgress(map), completions: [first, { ...first, nodeId: map.weeks[2].nodes[1].id }] }).completions).toEqual([{ ...first, xp: 0 }]);
    expect(normalizeProgress(map, { ...initialProgress(map), completions: [null] }).completions).toEqual([]);
  });
  it('handles corrupt or unavailable storage without breaking the map', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{', setItem: () => { throw Error('quota'); } });
    expect(loadMapProgress('course', map)).toEqual(initialProgress(map));
    expect(saveMapProgress('course', map, initialProgress(map))).toBe(false);
  });
});

describe('map navigation', () => {
  it('routes map links to onboarding without a completed profile and preserves the dedicated URL', () => {
    expect(routeFor('map')).toBe('#/courses/map');
    expect(resolveScreen('#/courses/map', 'welcome', false)).toBe('onboarding');
    expect(resolveScreen('#/courses/map', 'welcome', true)).toBe('map');
    expect(resolveScreen('#/courses', 'map', true)).toBe('adventure');
    expect(resolveScreen('#/profile', 'map', true)).toBe('complete');
  });
});
