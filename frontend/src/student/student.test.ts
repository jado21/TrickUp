import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialAnswers, type Answers } from '../onboarding-data';
import { createProfile, validStep } from '../profile-storage';
import { saveCourse } from '../courses/course-storage';
import { applyAction, createMissionSession, type MissionSession } from '../first-mission/engine';
import { expectedCodeOrder, rainQuestions } from '../first-mission/content';
import { commitMission, loadMission, saveMission } from '../first-mission/storage';
import { advanceDemo, completeFromMission, loadMapProgress, saveMapProgress } from '../learning-map/progress';
import { programmingLearningMap as map } from '../learning-map/programming-data';
import { ACTIVITY_STORAGE_KEY, loadActivities } from './activity-service';
import { adaptToPerformance, defaultAppearance, loadAppearance, personalize, saveAppearance } from './personalization-engine';
import { motivationMessage } from './motivation-engine';
import { localDay, shiftDay, validDay, validTimestamp, millisecondsUntilNextLocalDay } from './dates';
import { calculateStreak, firstStreakMilestone } from './streak-service';
import { creditedActivityXp, readProgressSnapshot, recordCourseAccess, resetStudentProgress } from './progress-service';
import { eligibleAchievements } from './achievement-service';
import { loadEngagement, markNotificationsRead, notificationText, saveEngagement, syncEngagement } from './notification-service';
import { resolveScreen } from '../navigation';

const answers: Answers = { ...initialAnswers, name: 'Alex', career: 'Ingeniería de Sistemas', cycle: '2', goal: 'pass_courses', motivation: 'personal_records', difficulty: 'guided', games: ['MEMORY_MATCH'], time: 'short', tone: 'calm' };
const at = '2026-11-07T16:00:00.000Z';
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k), key: (index: number) => [...values.keys()][index] ?? null, get length() { return values.size; } });
  vi.stubGlobal('fetch', vi.fn(() => { throw Error('No external calls expected'); }));
});
function course() { return saveCourse({ name: 'Programación I', career: answers.career, cycle: '2', method: 'catalog', catalogId: 'demo-programming-1' }).course; }
function finishRun(timestamp = at, errors = false) {
  let session = applyAction(createMissionSession(), { type: 'start' }, timestamp);
  if (errors) { session = applyAction(session, { type: 'flip', cardId: 'class-term' }, timestamp); session = applyAction(session, { type: 'flip', cardId: 'method-definition' }, timestamp); session = applyAction(session, { type: 'continue' }, timestamp); }
  for (const concept of ['class', 'object', 'attribute', 'method']) { session = applyAction(session, { type: 'flip', cardId: `${concept}-term` }, timestamp); session = applyAction(session, { type: 'flip', cardId: `${concept}-definition` }, timestamp); session = applyAction(session, { type: 'continue' }, timestamp); }
  for (const question of rainQuestions) { session = applyAction(session, { type: 'answer-rain', answerId: question.answer }, timestamp); session = applyAction(session, { type: 'continue' }, timestamp); }
  if (errors) { session = applyAction(session, { type: 'check-code' }, timestamp); session = applyAction(session, { type: 'continue' }, timestamp); }
  for (let i = 0; i < expectedCodeOrder.length; i++) session = applyAction(session, { type: 'move-block', blockId: expectedCodeOrder[i], target: i }, timestamp);
  session = applyAction(session, { type: 'check-code' }, timestamp);
  return applyAction(session, { type: 'continue' }, timestamp);
}
function saveRun(id: string, session: MissionSession) { saveMission(id, session); commitMission(id, session); }

describe('personalization and editable preferences', () => {
  it('preserves onboarding semantics and defaults without restricting any modality', () => {
    const personal = personalize(createProfile(answers));
    expect(personal.highlightedModes).toEqual(['MEMORY_MATCH']);
    expect(personal.recommendedModes).toHaveLength(5);
    expect(personal.timersEnabled).toBe(false);
    expect(personal.visualMode).toBe('calm');
    expect(personal.studyMinutes).toBe(15);
    expect(personal.visibleHints).toBe(true);
  });
  it('offers optional competitive challenges and highlights code only as a recommendation', () => {
    const personal = personalize(createProfile({ ...answers, tone: 'competitive' }), { ...defaultAppearance, programmingInterest: true });
    expect(personal.offerTimedChallenge).toBe(true);
    expect(personal.timersEnabled).toBe(false);
    expect(personal.recommendedModes[0]).toBe('ORDER_SEQUENCE');
    expect(personal.recommendedModes).toHaveLength(5);
    expect(personal.emphasizeRecords).toBe(true);
  });
  it('accepts disciplined tone without removing legacy friendly preference', () => {
    expect(validStep({ ...answers, tone: 'disciplined' }, 7)).toBe(true);
    expect(validStep({ ...answers, tone: 'friendly' }, 7)).toBe(true);
    expect(personalize(createProfile({ ...answers, tone: 'disciplined' })).visualMode).toBe('focused');
    expect(new Set(['competitive', 'humorous', 'calm', 'disciplined'].map(tone => motivationMessage('reminder', tone))).size).toBe(4);
  });
  it('persists appearance separately from academic answers and tolerates old/corrupt data', () => {
    saveAppearance({ ...defaultAppearance, visualMode: 'focused', programmingInterest: true });
    expect(loadAppearance().visualMode).toBe('focused');
    localStorage.setItem('trikup-appearance-v1', '{');
    expect(loadAppearance()).toEqual(defaultAppearance);
    localStorage.setItem('trikup-appearance-v1', JSON.stringify({ version: 99, visualMode: 'bad' }));
    expect(loadAppearance()).toEqual(defaultAppearance);
  });
  it('offers support after two errors and recognition after error-free completion', () => {
    expect(adaptToPerformance({ attempts: 2, mistakes: 2, hintsUsed: 0, xp: 0, completed: false })).toMatchObject({ needsReview: true, offerTheory: true, reduceTimerPressure: true });
    expect(adaptToPerformance({ attempts: 4, mistakes: 0, hintsUsed: 0, xp: 30, completed: true })).toMatchObject({ recognizeSuccess: true, offerOptionalChallenge: true });
  });
});

describe('normalized local dates and streaks', () => {
  it('uses Lima day boundaries, not UTC midnight or the execution host timezone', () => {
    expect(localDay(new Date('2026-11-08T04:59:59Z'))).toBe('2026-11-07');
    expect(localDay(new Date('2026-11-08T05:00:00Z'))).toBe('2026-11-08');
    expect(validDay('2026-02-30')).toBe(false);
    expect(validTimestamp('2026-02-30T12:00:00Z')).toBe(false);
    expect(shiftDay('2028-02-28', 1)).toBe('2028-02-29');
    expect(millisecondsUntilNextLocalDay(new Date('2026-11-08T04:59:00Z'))).toBeGreaterThanOrEqual(60000);
    expect(millisecondsUntilNextLocalDay(new Date('2026-11-08T04:59:00Z'))).toBeLessThan(62000);
  });
  it('counts one active day once and retains yesterday streak until a full day is missed', () => {
    const days = ['2026-11-05', '2026-11-06', '2026-11-06'];
    expect(calculateStreak(days, '2026-11-06')).toMatchObject({ current: 2, best: 2, totalDays: 2 });
    expect(calculateStreak(days, '2026-11-07').current).toBe(2);
    expect(calculateStreak(days, '2026-11-08').current).toBe(0);
    expect(calculateStreak(days, '2026-11-08').best).toBe(2);
  });
  it('handles gaps, sorting, milestones and future/invalid days', () => {
    const days = ['2026-11-03', 'bad', '2026-11-01', '2026-11-02', '2026-11-07', '2099-01-01'];
    expect(calculateStreak(days, '2026-11-07')).toMatchObject({ current: 1, best: 3, totalDays: 4, nextGoal: 3 });
    expect(firstStreakMilestone(days.filter(day => day <= '2026-11-07'), 3)).toBe('2026-11-03');
    expect(calculateStreak([], '2026-11-07').current).toBe(0);
  });
});

describe('one XP source, activities and historical data', () => {
  it('has no fictitious metrics or enrolled courses for a new learner', () => {
    const snapshot = readProgressSnapshot('2026-11-07');
    expect(snapshot.courses).toEqual([]);
    expect(snapshot.totalXp).toBe(0);
    expect(snapshot.accuracy).toBeNull();
    expect(snapshot.totalActivities).toBe(0);
    expect(snapshot.streak.current).toBe(0);
  });
  it('aggregates graded results, accuracy, game points and XP without adding balances', () => {
    const saved = course();
    const session = finishRun(at, true);
    saveRun(saved.id, session);
    saveRun(saved.id, session);
    const snapshot = readProgressSnapshot('2026-11-07');
    expect(snapshot).toMatchObject({ totalXp: 94, completedSublevels: 1, totalActivities: 3, accuracy: 80, attempts: 10, mistakes: 2, level: 1 });
    expect(snapshot.activeDays).toEqual(['2026-11-07']);
    expect(snapshot.activities.reduce((sum, activity) => sum + (creditedActivityXp(activity, snapshot) ?? 0), 0)).toBe(94);
    expect(loadActivities()).toHaveLength(3);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('counts completed practice as learning activity, but never credits its XP again', () => {
    const saved = course(); saveRun(saved.id, finishRun(at));
    saveRun(saved.id, finishRun('2026-11-08T16:00:00Z'));
    const snapshot = readProgressSnapshot('2026-11-08');
    expect(snapshot.totalXp).toBe(100);
    expect(snapshot.totalActivities).toBe(6);
    expect(snapshot.streak.current).toBe(2);
    expect(snapshot.activities.filter(activity => creditedActivityXp(activity, snapshot) === 0)).toHaveLength(3);
    expect(snapshot.level).toBe(2);
  });
  it('counts a completed minigame as an active day before the full mission awards XP', () => {
    const saved = course(); let session = applyAction(createMissionSession(), { type: 'start' }, at);
    for (const concept of ['class', 'object', 'attribute', 'method']) { session = applyAction(session, { type: 'flip', cardId: `${concept}-term` }, at); session = applyAction(session, { type: 'flip', cardId: `${concept}-definition` }, at); session = applyAction(session, { type: 'continue' }, at); }
    saveMission(saved.id, session);
    const snapshot = readProgressSnapshot('2026-11-07');
    expect(snapshot.totalActivities).toBe(1); expect(snapshot.totalXp).toBe(0); expect(snapshot.streak.current).toBe(1);
  });
  it('does not manufacture dates or streaks while migrating legacy completed journals', () => {
    const saved = course(); const session = finishRun();
    localStorage.setItem(`trikup-poo-mission-v1:${encodeURIComponent(saved.id)}`, JSON.stringify({ version: 1, memoryOrder: session.memoryOrder, builderOrder: session.builderOrder, journal: session.journal }));
    const legacy = loadMission(saved.id);
    expect(legacy.updatedAt).toBeNull(); expect(legacy.completedAt).toEqual({});
    saveMission(saved.id, legacy);
    const snapshot = readProgressSnapshot('2026-11-07');
    expect(snapshot.totalActivities).toBe(3); expect(snapshot.activeDays).toEqual([]); expect(snapshot.accuracy).toBe(100);
    expect(snapshot.activities.every(a => a.completedAt === null)).toBe(true);
  });
  it('distinguishes map development advance from real completions and activity', () => {
    const saved = course(); let progress = loadMapProgress(saved.id, map);
    for (let i = 0; i < 4; i++) progress = advanceDemo(map, progress, true);
    saveMapProgress(saved.id, map, progress);
    const snapshot = readProgressSnapshot('2026-11-07');
    expect(snapshot.courses[0].stats?.completedWeeks).toBe(1);
    expect(snapshot.completedWeeks).toBe(0); expect(snapshot.completedSublevels).toBe(0); expect(snapshot.totalXp).toBe(0); expect(snapshot.streak.current).toBe(0);
    expect(eligibleAchievements(snapshot)).toEqual([]);
  });
  it('records actual access separately and resets progress without deleting courses or profile', () => {
    const saved = course(); saveRun(saved.id, finishRun()); recordCourseAccess(saved.id, at);
    localStorage.setItem('trikup-onboarding-v1', 'preserve-profile');
    expect(readProgressSnapshot().courses[0].lastAccess).toBe(at);
    expect(resetStudentProgress()).toBe(true);
    const snapshot = readProgressSnapshot();
    expect(snapshot.courses).toHaveLength(1); expect(snapshot.totalXp).toBe(0); expect(snapshot.totalActivities).toBe(0);
    expect(localStorage.getItem('trikup-onboarding-v1')).toBe('preserve-profile');
  });
});

describe('achievements and internal notifications', () => {
  it('dates a genuinely evaluated week when its fourth node finishes and never adds badge XP', () => {
    const saved = course(); let progress = loadMapProgress(saved.id, map);
    for (let i = 0; i < 4; i++) progress = completeFromMission(map, progress, map.weeks[0].nodes[i].id, 10, { runId: `graded-${i}`, completedAt: `2026-11-0${i + 1}T16:00:00.000Z` });
    saveMapProgress(saved.id, map, progress);
    const snapshot = readProgressSnapshot('2026-11-07');
    expect(snapshot.completedWeeks).toBe(1);
    expect(eligibleAchievements(snapshot).find(badge => badge.id === 'first-week')?.earnedAt).toBe('2026-11-04T16:00:00.000Z');
    const first = syncEngagement(loadEngagement(), snapshot, { now: at });
    expect(syncEngagement(first, snapshot, { now: at }).earned).toEqual(first.earned);
    expect(readProgressSnapshot().totalXp).toBe(40);
  });
  it('unlocks first mission/sublevel once, persists read state and changes message tone without duplicate notices', () => {
    const saved = course(); saveRun(saved.id, finishRun(at));
    const snapshot = readProgressSnapshot('2026-11-07');
    const first = syncEngagement(loadEngagement(), snapshot, { now: at, visit: true });
    expect(first.earned.map(badge => badge.id)).toEqual(['first-mission', 'first-sublevel']);
    expect(first.earned.every(badge => badge.earnedAt === at)).toBe(true);
    const repeated = syncEngagement(first, snapshot, { now: at, visit: true });
    expect(repeated.notifications).toHaveLength(first.notifications.length); expect(repeated.earned).toEqual(first.earned);
    saveEngagement(markNotificationsRead(repeated));
    expect(loadEngagement().notifications.every(item => item.readAt)).toBe(true);
    const notice = first.notifications[0];
    expect(notificationText(notice, 'calm')).not.toBe(notificationText(notice, 'disciplined'));
  });
  it('awards consecutive-day and ten-activity badges without awarding extra XP', () => {
    const saved = course();
    for (let i = 1; i <= 7; i++) saveRun(saved.id, finishRun(`2026-11-0${i}T16:00:00.000Z`));
    const snapshot = readProgressSnapshot('2026-11-07');
    const earned = eligibleAchievements(snapshot);
    expect(snapshot.streak.current).toBe(7); expect(snapshot.totalActivities).toBe(21); expect(snapshot.totalXp).toBe(100);
    expect(earned.find(badge => badge.id === 'streak-3')?.earnedAt).toBe('2026-11-03');
    expect(earned.find(badge => badge.id === 'streak-7')?.earnedAt).toBe('2026-11-07');
    expect(earned.some(badge => badge.id === 'ten-activities')).toBe(true);
  });
  it('creates at most one reminder per local day and no activity merely for visiting', () => {
    const empty = readProgressSnapshot('2026-11-07');
    let engagement = syncEngagement(loadEngagement(), empty, { now: at, visit: true });
    engagement = syncEngagement(engagement, empty, { now: at, visit: true });
    expect(engagement.notifications.filter(item => item.type === 'reminder')).toHaveLength(1);
    engagement = syncEngagement(engagement, empty, { now: '2026-11-10T16:00:00Z', visit: true });
    expect(engagement.notifications.some(item => item.type === 'return')).toBe(true);
    expect(loadActivities()).toEqual([]); expect(empty.streak.current).toBe(0);
  });
  it('does not persist calendar preview calculations or artificial activity', () => {
    const before = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    expect(calculateStreak(['2026-11-07', '2026-11-08', '2026-11-09'], '2026-11-09').current).toBe(3);
    expect(localStorage.getItem(ACTIVITY_STORAGE_KEY)).toBe(before);
    expect(readProgressSnapshot('2026-11-07').totalActivities).toBe(0);
  });
  it('handles malformed engagement/activity data and guards dashboard/settings routes', () => {
    localStorage.setItem('trikup-engagement-v1', JSON.stringify({ version: 1, earned: [null, { id: 'invalid' }], notifications: [{ id: 'bad', type: 'success', createdAt: at, readAt: null, detail: {} }] }));
    expect(loadEngagement().notifications).toEqual([]);
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify({ version: 1, activities: [null, {}, { id: 'bad', stats: { xp: 999999 } }] }));
    expect(loadActivities()).toEqual([]);
    expect(resolveScreen('#/dashboard', 'welcome', false)).toBe('onboarding');
    expect(resolveScreen('#/settings', 'welcome', false)).toBe('onboarding');
    expect(resolveScreen('#/dashboard', 'welcome', true)).toBe('dashboard');
  });
});
