import { dayNumber, localDay, shiftDay, validDay } from './dates';
export function calculateStreak(days: readonly string[], today = localDay()) {
  const activeDays = [...new Set(days.filter(day => validDay(day) && day <= today))].sort();
  let best = 0, run = 0;
  for (let i = 0; i < activeDays.length; i++) { run = i > 0 && dayNumber(activeDays[i]) - dayNumber(activeDays[i - 1]) === 1 ? run + 1 : 1; best = Math.max(best, run); }
  const lastActiveDay = activeDays.at(-1) ?? null;
  let current = 0;
  if (lastActiveDay === today || lastActiveDay === shiftDay(today, -1)) {
    current = 1;
    for (let i = activeDays.length - 1; i > 0 && dayNumber(activeDays[i]) - dayNumber(activeDays[i - 1]) === 1; i--) current++;
  }
  return { current, best, lastActiveDay, activeDays, totalDays: activeDays.length, nextGoal: [3, 7, 14, 30, 60, 100].find(goal => goal > current) ?? Math.ceil((current + 1) / 100) * 100 };
}
export function firstStreakMilestone(days: readonly string[], target: number): string | null {
  const sorted = [...new Set(days.filter(validDay))].sort(); let run = 0;
  for (let i = 0; i < sorted.length; i++) { run = i > 0 && dayNumber(sorted[i]) - dayNumber(sorted[i - 1]) === 1 ? run + 1 : 1; if (run >= target) return sorted[i]; }
  return null;
}
