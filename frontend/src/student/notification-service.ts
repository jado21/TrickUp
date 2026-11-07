import { achievements, eligibleAchievements, type EarnedAchievement } from './achievement-service';
import { dayNumber, localDay, validDay, validTimestamp } from './dates';
import { motivationMessage, type MotivationContext } from './motivation-engine';
import type { ProgressSnapshot } from './progress-service';

export type StudentNotification = { id: string; type: 'reminder' | 'success' | 'unlock' | 'streak' | 'review' | 'reward' | 'return'; createdAt: string; readAt: string | null; courseId?: string; detail?: string };
export type EngagementState = { version: 1; notifications: StudentNotification[]; earned: EarnedAchievement[]; lastVisitDay: string | null };
export function loadEngagement(): EngagementState {
  const empty: EngagementState = { version: 1, notifications: [], earned: [], lastVisitDay: null };
  try {
    const value = JSON.parse(localStorage.getItem('trikup-engagement-v1') ?? 'null');
    if (value?.version !== 1) return empty;
    return { version: 1, lastVisitDay: validDay(value.lastVisitDay) ? value.lastVisitDay : null, earned: Array.isArray(value.earned) ? [...new Map<string, EarnedAchievement>(value.earned.filter((a: EarnedAchievement) => a && achievements.some(definition => definition.id === a.id) && (a.earnedAt === null || validDay(a.earnedAt) || validTimestamp(a.earnedAt))).map((a: EarnedAchievement) => [a.id, a] as const)).values()] : [], notifications: Array.isArray(value.notifications) ? [...new Map<string, StudentNotification>(value.notifications.filter((n: StudentNotification) => n && typeof n.id === 'string' && ['reminder', 'success', 'unlock', 'streak', 'review', 'reward', 'return'].includes(n.type) && validTimestamp(n.createdAt) && (n.readAt === null || validTimestamp(n.readAt)) && (n.detail === undefined || typeof n.detail === 'string') && (n.courseId === undefined || typeof n.courseId === 'string')).map((n: StudentNotification) => [n.id, n] as const)).values()] : [] };
  } catch { return empty; }
}
export function saveEngagement(state: EngagementState): boolean { try { localStorage.setItem('trikup-engagement-v1', JSON.stringify(state)); return true; } catch { return false; } }

export function syncEngagement(previous: EngagementState, snapshot: ProgressSnapshot, options: { now?: string; visit?: boolean; reminders?: boolean } = {}): EngagementState {
  const now = options.now ?? new Date().toISOString();
  const today = localDay(new Date(now));
  const state: EngagementState = { version: 1, notifications: [...previous.notifications], earned: [...previous.earned], lastVisitDay: previous.lastVisitDay };
  const add = (notification: Omit<StudentNotification, 'readAt'>) => { if (!state.notifications.some(item => item.id === notification.id)) state.notifications.push({ ...notification, readAt: null }); };
  for (const activity of snapshot.activities) if (activity.completedAt) add({ id: `activity:${activity.courseId}:${activity.id}`, type: 'success', courseId: activity.courseId, createdAt: activity.completedAt, detail: `${activity.game === 'memory' ? 'Memoria' : activity.game === 'rain' ? 'Lluvia' : 'Constructor'} completado` });
  for (const completion of snapshot.evaluated) if (completion.completedAt) add({ id: `unlock:${completion.courseId}:${completion.nodeId}`, type: 'unlock', createdAt: completion.completedAt, courseId: completion.courseId });
  for (const review of snapshot.reviews) add({ id: `review:${review.id}`, type: 'review', createdAt: review.at, courseId: review.courseId, detail: review.game });
  for (const badge of eligibleAchievements(snapshot)) {
    if (!state.earned.some(item => item.id === badge.id)) state.earned.push(badge);
    if (badge.earnedAt) {
      const createdAt = validDay(badge.earnedAt) ? `${badge.earnedAt}T17:00:00.000Z` : badge.earnedAt;
      add({ id: `badge:${badge.id}`, type: badge.id.startsWith('streak') ? 'streak' : 'reward', createdAt, detail: achievements.find(definition => definition.id === badge.id)!.name });
    }
  }
  if (options.visit) {
    if (state.lastVisitDay && dayNumber(today) - dayNumber(state.lastVisitDay) >= 2) add({ id: `return:${today}`, type: 'return', createdAt: now });
    if (options.reminders !== false && !snapshot.activeDays.includes(today)) add({ id: `reminder:${today}`, type: 'reminder', createdAt: now });
    state.lastVisitDay = today;
  }
  state.notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  return state;
}
export function notificationText(notification: StudentNotification, tone: string): string { return motivationMessage(notification.type as MotivationContext, tone); }
export function markNotificationsRead(state: EngagementState, id?: string, at = new Date().toISOString()): EngagementState { return { ...state, notifications: state.notifications.map(item => (!id || item.id === id) && !item.readAt ? { ...item, readAt: at } : item) }; }
