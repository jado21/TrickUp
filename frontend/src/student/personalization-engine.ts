import type { StudentProfile } from '../profile-storage';
import type { Answers } from '../onboarding-data';
import type { GameStats } from '../first-mission/engine';
export type MotivationTone = 'friendly' | 'competitive' | 'humorous' | 'calm' | 'disciplined';
export type VisualMode = 'adventure' | 'calm' | 'focused' | 'competitive';
export type ActivityMode = 'MEMORY_MATCH' | 'ORDER_SEQUENCE' | 'MULTIPLE_CHOICE' | 'FILL_BLANK' | 'FALLING_TILES';
export const ACTIVITY_MODES: ActivityMode[] = ['MEMORY_MATCH', 'ORDER_SEQUENCE', 'MULTIPLE_CHOICE', 'FILL_BLANK', 'FALLING_TILES'];
export const ACTIVITY_LABELS: Record<ActivityMode, string> = { MEMORY_MATCH: 'Memoria de conceptos', ORDER_SEQUENCE: 'Ordenamiento y construcción', MULTIPLE_CHOICE: 'Preguntas de selección', FILL_BLANK: 'Completar respuestas', FALLING_TILES: 'Bloques descendentes' };
export type AppearancePreferences = { version: 1; visualMode: VisualMode | 'auto'; programmingInterest: boolean; remindersEnabled: boolean; demoProfile: boolean };
export const defaultAppearance: AppearancePreferences = { version: 1, visualMode: 'auto', programmingInterest: false, remindersEnabled: true, demoProfile: false };
export function normalizeTone(value: string): MotivationTone { return ['friendly', 'competitive', 'humorous', 'calm', 'disciplined'].includes(value) ? value as MotivationTone : 'friendly'; }
export function experienceFromAnswers(answers: Answers) {
  const messageTone = normalizeTone(answers.tone);
  const preferred = answers.games.filter((id): id is ActivityMode => ACTIVITY_MODES.includes(id as ActivityMode));
  return { gameModes: [...preferred], messageTone, emphasizeRecords: messageTone === 'competitive' || ['competition', 'personal_records'].includes(answers.motivation), timersEnabled: false, offerTimedChallenge: messageTone === 'competitive', visibleHints: ['hints', 'guided'].includes(answers.difficulty), stepByStepHelp: answers.difficulty === 'guided', dailyTime: answers.time, studyMinutes: ({ short: 15, medium: 30, long: 45 } as Record<string, number>)[answers.time] ?? null };
}
export function personalize(profile: StudentProfile, appearance: AppearancePreferences = defaultAppearance) {
  const base = experienceFromAnswers(profile.answers);
  const priority = [...base.gameModes];
  if (appearance.programmingInterest) { const index = priority.indexOf('ORDER_SEQUENCE'); if (index >= 0) priority.splice(index, 1); priority.unshift('ORDER_SEQUENCE'); }
  const automaticMode: VisualMode = base.messageTone === 'calm' ? 'calm' : base.messageTone === 'competitive' ? 'competitive' : base.messageTone === 'disciplined' ? 'focused' : 'adventure';
  const visualMode = appearance.visualMode === 'auto' ? automaticMode : appearance.visualMode;
  return { ...base, recommendedModes: [...new Set([...priority, ...ACTIVITY_MODES])], highlightedModes: priority, visualMode, reduceMotion: visualMode === 'calm' };
}
export function adaptToPerformance(stats: GameStats) {
  const needsReview = stats.mistakes >= 2;
  return { needsReview, offerTheory: needsReview, offerExtraHint: needsReview, reduceTimerPressure: needsReview, recognizeSuccess: stats.completed && stats.mistakes === 0, offerOptionalChallenge: stats.completed && stats.mistakes === 0, accuracy: stats.attempts ? Math.round((stats.attempts - stats.mistakes) / stats.attempts * 100) : null };
}
export function loadAppearance(): AppearancePreferences {
  try {
    const v = JSON.parse(localStorage.getItem('trikup-appearance-v1') ?? 'null');
    if (v?.version !== 1) return { ...defaultAppearance };
    return { version: 1, visualMode: ['auto', 'adventure', 'calm', 'focused', 'competitive'].includes(v.visualMode) ? v.visualMode : 'auto', programmingInterest: v.programmingInterest === true, remindersEnabled: v.remindersEnabled !== false, demoProfile: v.demoProfile === true };
  } catch { return { ...defaultAppearance }; }
}
export function saveAppearance(value: AppearancePreferences): boolean { try { localStorage.setItem('trikup-appearance-v1', JSON.stringify(value)); return true; } catch { return false; } }
