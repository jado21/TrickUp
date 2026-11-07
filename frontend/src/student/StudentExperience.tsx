import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Answers } from '../onboarding-data';
import type { StudentProfile } from '../profile-storage';
import { validStep } from '../profile-storage';
import type { CreatedCourse } from '../courses/types';
import { loadSelectedCourse } from '../courses/course-storage';
import type { AppScreen } from '../navigation';
import { loadAppearance, personalize, saveAppearance, type AppearancePreferences } from './personalization-engine';
import { readProgressSnapshot, resetStudentProgress, recordCourseAccess } from './progress-service';
import { loadEngagement, markNotificationsRead, saveEngagement, syncEngagement } from './notification-service';
import { STUDENT_DATA_EVENT } from './local-events';
import { millisecondsUntilNextLocalDay } from './dates';
import './student.css';

type Navigation = { onDashboard: () => void; onSettings: () => void; onCourses: () => void; onCourse: (course: CreatedCourse, nodeId?: string) => void; onSaveProfile: (answers: Answers) => boolean };
function useExperienceState(profile: StudentProfile | undefined, screen: AppScreen, navigation: Navigation) {
  const [appearance, setAppearance] = useState(loadAppearance);
  const [snapshot, setSnapshot] = useState(readProgressSnapshot);
  const [engagement, setEngagement] = useState(loadEngagement);
  const [revision, setRevision] = useState(0);
  const [storageWarning, setStorageWarning] = useState('');
  const personalization = profile ? personalize(profile, appearance) : null;
  const refresh = () => setRevision(value => value + 1);
  useEffect(() => {
    window.addEventListener(STUDENT_DATA_EVENT, refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    let timer: number;
    const schedule = () => { timer = window.setTimeout(() => { refresh(); schedule(); }, millisecondsUntilNextLocalDay()); };
    schedule();
    return () => { window.removeEventListener(STUDENT_DATA_EVENT, refresh); window.removeEventListener('storage', refresh); window.removeEventListener('focus', refresh); window.clearTimeout(timer); };
  }, []);
  useEffect(() => {
    const next = readProgressSnapshot();
    setSnapshot(next);
    if (!profile) return;
    const previous = loadEngagement();
    const synced = syncEngagement(previous, next, { visit: screen === 'dashboard', reminders: appearance.remindersEnabled });
    setEngagement(synced);
    if (JSON.stringify(previous) !== JSON.stringify(synced) && !saveEngagement(synced)) setStorageWarning('Algunos cambios no se pudieron guardar. Mantén esta pestaña abierta para conservarlos durante la sesión.');
  }, [revision, screen, profile?.answers.tone, appearance.remindersEnabled, !!profile]);
  const mode = personalization?.visualMode ?? 'adventure';
  useEffect(() => { document.documentElement.dataset.visualMode = mode; }, [mode]);
  useEffect(() => { if (screen === 'map' || screen === 'mission') { const course = loadSelectedCourse(); if (course) recordCourseAccess(course.id); } }, [screen]);
  function savePreferences(answers: Answers, nextAppearance: AppearancePreferences): boolean {
    if (!Array.from({ length: 8 }, (_, i) => validStep(answers, i)).every(Boolean)) throw new Error('Revisa los datos obligatorios y elige una o dos modalidades.');
    const profileSaved = navigation.onSaveProfile(answers);
    const appearanceSaved = saveAppearance(nextAppearance);
    setAppearance(nextAppearance); refresh();
    if (!profileSaved || !appearanceSaved) setStorageWarning('Los cambios se aplican durante esta sesión; no se pudieron guardar todos en el navegador.');
    return profileSaved && appearanceSaved;
  }
  function markRead(id?: string) { const next = markNotificationsRead(engagement, id); setEngagement(next); if (!saveEngagement(next)) setStorageWarning('El estado de lectura solo se conservará durante esta sesión.'); }
  function resetProgress() { const saved = resetStudentProgress(); setEngagement(loadEngagement()); refresh(); if (!saved) setStorageWarning('No se pudo reiniciar todo el progreso. Revisa el almacenamiento del navegador.'); return saved; }
  return { profile, appearance, personalization, snapshot, engagement, storageWarning, savePreferences, markRead, resetProgress, refresh, ...navigation };
}
type ExperienceValue = ReturnType<typeof useExperienceState>;
const ExperienceContext = createContext<ExperienceValue | null>(null);
export function StudentExperienceProvider({ profile, screen, navigation, children }: { profile?: StudentProfile; screen: AppScreen; navigation: Navigation; children: ReactNode }) {
  const value = useExperienceState(profile, screen, navigation);
  return <ExperienceContext.Provider value={value}>{children}</ExperienceContext.Provider>;
}
export function useStudentExperience(): ExperienceValue { const context = useContext(ExperienceContext); if (!context) throw new Error('Falta el contexto de experiencia del estudiante.'); return context; }
