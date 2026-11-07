import { loadCourses, loadSelectedCourse } from '../courses/course-storage';
import { loadMission } from '../first-mission/storage';
import { gameDefinitions } from '../first-mission/content';
import { programmingLearningMap as map } from '../learning-map/programming-data';
import { getProgressStats, loadMapProgress } from '../learning-map/progress';
import { activitiesFromSession, loadActivities, TOPIC_LABELS, type ActivityResult, type TopicId } from './activity-service';
import { localDay, validTimestamp } from './dates';
import { announceStudentData } from './local-events';
import { calculateStreak } from './streak-service';

export function readProgressSnapshot(today = localDay()) {
  const courses = loadCourses();
  const access = loadCourseAccess();
  const courseProgress = courses.map(course => {
    const progress = course.catalogId === 'demo-programming-1' ? loadMapProgress(course.id, map) : null;
    return { course, progress, stats: progress ? getProgressStats(map, progress) : null, lastAccess: access[course.id] ?? null };
  });
  const activities = new Map(loadActivities().filter(activity => courses.some(course => course.id === activity.courseId)).map(item => [item.id, item]));
  const reviews: { id: string; courseId: string; game: string; at: string }[] = [];
  for (const course of courses) {
    let hasSession = false;
    try { hasSession = !!localStorage.getItem(`trikup-poo-mission-v1:${encodeURIComponent(course.id)}`); } catch { /* unavailable */ }
    if (!hasSession) continue;
    const session = loadMission(course.id);
    for (const activity of activitiesFromSession(course.id, session)) if (!activities.has(activity.id)) activities.set(activity.id, activity);
    for (const game of gameDefinitions) if (session.state[game.id].stats.mistakes >= 2 && validTimestamp(session.updatedAt)) reviews.push({ id: `${course.id}:${session.runId}:${game.id}`, courseId: course.id, game: game.name, at: session.updatedAt });
  }
  const results = [...activities.values()].sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '') || a.id.localeCompare(b.id));
  const attempts = results.reduce((sum, result) => sum + result.stats.attempts, 0);
  const mistakes = results.reduce((sum, result) => sum + result.stats.mistakes, 0);
  const totalXp = courseProgress.reduce((sum, c) => sum + (c.stats?.xp ?? 0), 0);
  const evaluated = courseProgress.flatMap(c => c.progress?.completions.filter(entry => entry.source === 'mission').map(entry => ({ ...entry, courseId: c.course.id })) ?? []);
  const realWeeks = courseProgress.reduce((sum, c) => sum + (c.progress ? map.weeks.filter(week => week.nodes.every(node => c.progress!.completions.some(entry => entry.nodeId === node.id && entry.source === 'mission'))).length : 0), 0);
  const activeDays = [...new Set(results.flatMap(result => result.completedAt ? [localDay(new Date(result.completedAt))] : []))].filter(day => day <= today).sort();
  const topics = Object.entries(TOPIC_LABELS).map(([id, label]) => {
    const observations = results.flatMap(result => result.observations).filter(observation => observation.topic === id);
    const correct = observations.filter(observation => observation.correct).length;
    return { id: id as TopicId, label, samples: observations.length, correct, mistakes: observations.length - correct, percent: observations.length ? Math.round(correct / observations.length * 100) : null };
  });
  const selected = loadSelectedCourse(courses);
  const currentCourse = courseProgress.find(c => c.course.id === selected?.id) ?? courseProgress.find(c => c.stats && !c.stats.finished) ?? courseProgress[0];
  return { courses: courseProgress, currentCourse, activities: results, totalXp, level: 1 + Math.floor(totalXp / 100), levelXp: totalXp % 100, completedSublevels: evaluated.length, evaluated, completedWeeks: realWeeks, totalActivities: results.length, attempts, mistakes, accuracy: attempts ? Math.round((attempts - mistakes) / attempts * 100) : null, streak: calculateStreak(activeDays, today), activeDays, topics, reviews, bestActivityScore: results.length ? Math.max(...results.map(a => a.stats.xp)) : 0 };
}
export type ProgressSnapshot = ReturnType<typeof readProgressSnapshot>;

export function creditedActivityXp(activity: ActivityResult, snapshot: ProgressSnapshot): number | null {
  const completion = snapshot.courses.find(course => course.course.id === activity.courseId)?.progress?.completions.find(entry => entry.nodeId === activity.nodeId && entry.source === 'mission');
  if (!completion) return 0;
  if (!completion.runId) return null;
  return completion.runId === activity.runId ? activity.stats.xp : 0;
}

export function loadCourseAccess(): Record<string, string> {
  try {
    const value = JSON.parse(localStorage.getItem('trikup-course-access-v1') ?? 'null');
    if (value?.version !== 1 || !value.access || typeof value.access !== 'object') return {};
    return Object.fromEntries(Object.entries(value.access).filter((entry): entry is [string, string] => validTimestamp(entry[1])));
  } catch { return {}; }
}
export function recordCourseAccess(courseId: string, at = new Date().toISOString()): boolean {
  try { localStorage.setItem('trikup-course-access-v1', JSON.stringify({ version: 1, access: { ...loadCourseAccess(), [courseId]: at } })); announceStudentData(); return true; } catch { return false; }
}

export function resetStudentProgress(): boolean {
  try {
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter((key): key is string => !!key);
    for (const key of keys) if (key.startsWith('trikup-map-v1:') || key.startsWith('trikup-poo-mission-v1:') || ['trikup-activities-v1', 'trikup-engagement-v1'].includes(key)) localStorage.removeItem(key);
    const courses = loadCourses().map(course => ({ ...course, progress: { completedSublevels: [], xp: 0 } }));
    localStorage.setItem('trikup-courses-v1', JSON.stringify(courses));
    announceStudentData(); return true;
  } catch { return false; }
}
