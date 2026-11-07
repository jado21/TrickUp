import type { ProgressSnapshot } from './progress-service';
import { firstStreakMilestone } from './streak-service';
import { programmingLearningMap as map } from '../learning-map/programming-data';
export const achievements = [
  { id: 'first-mission', name: 'Misión aceptada', description: 'Completa los tres juegos de una misión evaluada.', condition: 'Una misión completada', icon: 'flag' },
  { id: 'first-sublevel', name: 'Primer portal', description: 'Completa un subnivel jugando y registra su resultado.', condition: 'Un subnivel evaluado en el mapa', icon: 'compass' },
  { id: 'first-week', name: 'Semana conquistada', description: 'Completa los cuatro subniveles de una semana mediante actividades evaluadas.', condition: 'Una semana sin avances de desarrollo', icon: 'trophy' },
  { id: 'streak-3', name: 'Paso constante', description: 'Dedica tres días consecutivos a completar actividades.', condition: 'Tres días activos consecutivos', icon: 'bolt' },
  { id: 'streak-7', name: 'Siete amaneceres', description: 'Completa actividades durante siete días consecutivos.', condition: 'Siete días activos consecutivos', icon: 'fire' },
  { id: 'ten-activities', name: 'Explorador constante', description: 'Completa diez minijuegos. Las prácticas también cuentan como aprendizaje.', condition: 'Diez actividades finalizadas', icon: 'gem' },
] as const;
export type AchievementId = typeof achievements[number]['id'];
export type EarnedAchievement = { id: AchievementId; earnedAt: string | null };
export function eligibleAchievements(snapshot: ProgressSnapshot): EarnedAchievement[] {
  const first = [...snapshot.evaluated].sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? ''))[0];
  const result: EarnedAchievement[] = [];
  if (first) result.push({ id: 'first-mission', earnedAt: first.completedAt ?? null }, { id: 'first-sublevel', earnedAt: first.completedAt ?? null });
  if (snapshot.completedWeeks) {
    const dates = snapshot.courses.flatMap(course => map.weeks.flatMap(week => {
      const entries = week.nodes.map(node => course.progress?.completions.find(entry => entry.nodeId === node.id && entry.source === 'mission'));
      if (entries.some(entry => !entry)) return [];
      return [entries.every(entry => entry!.completedAt) ? entries.map(entry => entry!.completedAt!).sort().at(-1)! : null];
    })).sort((a, b) => (a ?? '').localeCompare(b ?? ''));
    result.push({ id: 'first-week', earnedAt: dates[0] ?? null });
  }
  for (const target of [3, 7] as const) { const day = firstStreakMilestone(snapshot.activeDays, target); if (day) result.push({ id: `streak-${target}`, earnedAt: day }); }
  if (snapshot.totalActivities >= 10) result.push({ id: 'ten-activities', earnedAt: [...snapshot.activities].sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? ''))[9].completedAt });
  return result;
}
