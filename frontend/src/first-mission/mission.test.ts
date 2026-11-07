import { beforeEach, describe, expect, it, vi } from 'vitest';
import { codeBlocks, expectedCodeOrder, FIRST_NODE_ID, memoryCards, rainQuestions } from './content';
import { applyAction, createMissionSession, evaluateCode, evaluatePair, evaluateRain, gameScore, missionCompleted, missionXp, shuffle, type MissionSession } from './engine';
import { commitMission, loadMission, saveMission } from './storage';
import { advanceDemo, getNodeState, getProgressStats, initialProgress, loadMapProgress, saveMapProgress } from '../learning-map/progress';
import { programmingLearningMap as map } from '../learning-map/programming-data';
import { resolveScreen } from '../navigation';

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
  vi.stubGlobal('fetch', vi.fn(() => { throw Error('No network expected'); }));
});

function solveMemory(session: MissionSession) {
  let result = applyAction(session, { type: 'start' });
  for (const concept of ['class', 'object', 'attribute', 'method']) {
    result = applyAction(result, { type: 'flip', cardId: `${concept}-term` });
    result = applyAction(result, { type: 'flip', cardId: `${concept}-definition` });
    result = applyAction(result, { type: 'continue' });
  }
  return result;
}
function solveRain(session: MissionSession) {
  let result = session;
  for (const question of rainQuestions) { result = applyAction(result, { type: 'answer-rain', answerId: question.answer }); result = applyAction(result, { type: 'continue' }); }
  return result;
}
function solveBuilder(session: MissionSession) {
  let result = session;
  for (let i = 0; i < expectedCodeOrder.length; i++) result = applyAction(result, { type: 'move-block', blockId: expectedCodeOrder[i], target: i });
  result = applyAction(result, { type: 'check-code' });
  return applyAction(result, { type: 'continue' });
}

describe('deterministic game evaluation', () => {
  it('recognizes term-definition pairs, not repeated cards or two concept cards', () => {
    expect(evaluatePair('class-term', 'class-definition').correct).toBe(true);
    expect(evaluatePair('object-definition', 'object-term').correct).toBe(true);
    expect(evaluatePair('class-term', 'class-term').correct).toBe(false);
    expect(evaluatePair('class-term', 'object-term').correct).toBe(false);
    expect(evaluatePair('class-term', 'method-definition').correct).toBe(false);
    expect(evaluatePair('unknown', 'class-term').correct).toBe(false);
  });
  it('checks falling answers against each question identifier', () => {
    expect(evaluateRain(0, 'class').correct).toBe(true);
    expect(evaluateRain(1, 'attribute').correct).toBe(true);
    expect(evaluateRain(2, 'method').correct).toBe(true);
    expect(evaluateRain(0, 'object').correct).toBe(false);
    expect(evaluateRain(99, 'class').correct).toBe(false);
  });
  it('checks code IDs and exact nesting, never executable or user-edited text', () => {
    expect(evaluateCode(expectedCodeOrder).correct).toBe(true);
    expect(evaluateCode([...expectedCodeOrder].reverse()).correct).toBe(false);
    expect(evaluateCode(expectedCodeOrder.slice(1)).correct).toBe(false);
    expect(evaluateCode(codeBlocks.map(block => block.code)).correct).toBe(false);
    expect(evaluateCode(Array(8).fill('class-header')).correct).toBe(false);
  });
  it('shuffles without changing or repeating cards and starts code unsolved', () => {
    const cards = shuffle(memoryCards.map(card => card.id), () => 0);
    expect(new Set(cards).size).toBe(8);
    expect(cards).not.toEqual(memoryCards.map(card => card.id));
    const session = createMissionSession();
    expect(evaluateCode(session.builderOrder).correct).toBe(false);
  });
});

describe('sequential learning', () => {
  it('prevents jumping to later games or completing by starting and opening cards', () => {
    let session = createMissionSession();
    const initial = session;
    session = applyAction(session, { type: 'answer-rain', answerId: 'class' });
    session = applyAction(session, { type: 'check-code' });
    session = applyAction(session, { type: 'continue' });
    expect(session).toBe(initial);
    session = applyAction(session, { type: 'start' });
    session = applyAction(session, { type: 'flip', cardId: 'class-term' });
    expect(session.state.memory.stats.attempts).toBe(0);
    expect(missionCompleted(session.state)).toBe(false);
    expect(commitMission('course', session).completed).toBe(false);
    expect(getProgressStats(map, loadMapProgress('course', map)).completed).toBe(0);
  });
  it('locks the selected pair until feedback is acknowledged and clears mismatches for retry', () => {
    let session = applyAction(createMissionSession(), { type: 'start' });
    session = applyAction(session, { type: 'flip', cardId: 'class-term' });
    session = applyAction(session, { type: 'flip', cardId: 'method-definition' });
    expect(session.state.memory.feedback?.correct).toBe(false);
    expect(session.state.memory.stats).toMatchObject({ attempts: 1, mistakes: 1 });
    expect(applyAction(session, { type: 'flip', cardId: 'object-term' })).toBe(session);
    session = applyAction(session, { type: 'continue' });
    expect(session.state.memory.open).toEqual([]);
    expect(session.state.phase).toBe('memory');
  });
  it('requires a correct falling answer before moving to the next question', () => {
    let session = solveMemory(createMissionSession());
    session = applyAction(session, { type: 'answer-rain', answerId: 'object' });
    session = applyAction(session, { type: 'continue' });
    expect(session.state.rain.questionIndex).toBe(0);
    session = applyAction(session, { type: 'answer-rain', answerId: 'class' });
    expect(applyAction(session, { type: 'answer-rain', answerId: 'class' })).toBe(session);
    session = applyAction(session, { type: 'continue' });
    expect(session.state.rain.questionIndex).toBe(1);
  });
  it('completes all three games with maximum XP only after correct code ordering', () => {
    let session = solveMemory(createMissionSession());
    expect(session.state.phase).toBe('rain');
    expect(session.state.memory.stats).toMatchObject({ attempts: 4, mistakes: 0, completed: true, xp: 30 });
    session = solveRain(session);
    expect(session.state.phase).toBe('builder');
    expect(missionCompleted(session.state)).toBe(false);
    session = solveBuilder(session);
    expect(session.state.phase).toBe('complete');
    expect(missionCompleted(session.state)).toBe(true);
    expect(missionXp(session.state)).toBe(100);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('score and rewards', () => {
  it('uses transparent error/hint costs with floors that never block completion', () => {
    expect(gameScore('memory', 1, 1)).toBe(26);
    expect(gameScore('rain', 1, 1)).toBe(25);
    expect(gameScore('builder', 1, 2)).toBe(30);
    expect(gameScore('memory', 100, 100)).toBe(10);
    expect(gameScore('rain', 100, 100)).toBe(10);
    expect(gameScore('builder', 100, 100)).toBe(15);
  });
  it('tracks hints and mistakes separately and freezes a completed game score', () => {
    let session = applyAction(createMissionSession(), { type: 'start' });
    session = applyAction(session, { type: 'hint', game: 'memory' });
    session = applyAction(session, { type: 'flip', cardId: 'class-term' });
    session = applyAction(session, { type: 'flip', cardId: 'method-definition' });
    session = applyAction(session, { type: 'continue' });
    session = solveMemory(session);
    expect(session.state.memory.stats).toMatchObject({ attempts: 5, mistakes: 1, hintsUsed: 1, xp: 26 });
    expect(applyAction(session, { type: 'hint', game: 'memory' })).toBe(session);
  });
  it('credits a completed mission once, including after replay and reload', () => {
    const session = solveBuilder(solveRain(solveMemory(createMissionSession())));
    const first = commitMission('course', session);
    expect(first.persisted).toBe(true);
    expect(first.awardedXp).toBe(100);
    expect(getNodeState(map, first.progress, FIRST_NODE_ID)).toBe('completed');
    expect(getNodeState(map, first.progress, 'pi17-w01-n2')).toBe('current');
    expect(commitMission('course', session).awardedXp).toBe(0);
    const replay = solveBuilder(solveRain(solveMemory(createMissionSession())));
    expect(commitMission('course', replay).awardedXp).toBe(0);
    expect(getProgressStats(map, loadMapProgress('course', map)).xp).toBe(100);
  });
  it('replaces a legacy demo completion once without discarding later demo progress', () => {
    let progress = initialProgress(map);
    for (let i = 0; i < 4; i++) progress = advanceDemo(map, progress, true);
    saveMapProgress('course', map, progress);
    const session = solveBuilder(solveRain(solveMemory(createMissionSession())));
    const result = commitMission('course', session);
    expect(getProgressStats(map, result.progress)).toMatchObject({ completed: 4, xp: 100 });
    expect(result.progress.completions[0].source).toBe('mission');
    expect(commitMission('course', session).awardedXp).toBe(0);
  });
});

describe('partial persistence and guards', () => {
  it('replays partial progress, order, attempts and feedback exactly after reload', () => {
    let session = solveMemory(createMissionSession());
    session = applyAction(session, { type: 'hint', game: 'rain' });
    session = applyAction(session, { type: 'answer-rain', answerId: 'object' });
    expect(saveMission('course-a', session)).toBe(true);
    expect(loadMission('course-a')).toEqual(session);
    expect(loadMission('course-b').state.phase).toBe('intro');
    session = solveBuilder(solveRain(applyAction(session, { type: 'continue' })));
    saveMission('course-a', session);
    expect(loadMission('course-a').state.phase).toBe('complete');
  });
  it('ignores fabricated XP/phase snapshots and rejects corrupt action logs', () => {
    const session = createMissionSession();
    const key = 'trikup-poo-mission-v1:course';
    localStorage.setItem(key, JSON.stringify({ ...session, state: { phase: 'complete', xp: 999999 } }));
    expect(loadMission('course').state.phase).toBe('intro');
    localStorage.setItem(key, JSON.stringify({ ...session, journal: [{ type: 'award-xp', xp: 99999 }] }));
    expect(loadMission('course').journal).toEqual([]);
    localStorage.setItem(key, JSON.stringify({ ...session, memoryOrder: Array(8).fill('class-term') }));
    expect(new Set(loadMission('course').memoryOrder).size).toBe(8);
  });
  it('handles storage failures and protects direct mission links without a profile', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw Error(); }, setItem: () => { throw Error(); } });
    const session = loadMission('course');
    expect(session.state.phase).toBe('intro');
    expect(saveMission('course', session)).toBe(false);
    expect(resolveScreen('#/courses/map/poo', 'map', false)).toBe('onboarding');
    expect(resolveScreen('#/courses/map/poo', 'map', true)).toBe('mission');
  });
});
