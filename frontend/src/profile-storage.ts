import { experienceFromAnswers } from "./student/personalization-engine";
import { initialAnswers, goals, motivations, difficulties, gameOptions, timeOptions, toneOptions, careerOptions, type Answers, type Option } from './onboarding-data';
export const label = (options: Option[], id: string) => options.find(o => o.id === id)?.title ?? id;
export function validStep(a: Answers, step: number): boolean {
 const has = (list: Option[], value: string) => list.some(o => o.id === value);
 return [!!a.name.trim() && a.name.length <= 28, careerOptions.includes(a.career) && (a.career !== 'Otra' || !!a.otherCareer.trim()) && (/^(10|[1-9])$/.test(a.cycle) || (a.cycle === 'Otro' && !!a.otherCycle.trim())), has(goals,a.goal), has(motivations,a.motivation), has(difficulties,a.difficulty), a.games.length >= 1 && a.games.length <= 2 && new Set(a.games).size === a.games.length && a.games.every(g => has(gameOptions,g)), has(timeOptions,a.time), has(toneOptions,a.tone)][step] ?? false;
}
export function experienceConfig(a: Answers) {
 return experienceFromAnswers(a);
}
export type StudentProfile = { version: 1; answers: Answers; level: 1; xp: 0; experience: ReturnType<typeof experienceConfig> };
type Session = { answers: Answers; step: number; screen: 'welcome' | 'onboarding' | 'complete' | 'adventure'; profile?: StudentProfile };
export function createProfile(a: Answers): StudentProfile { return { version:1, answers:{...a,name:a.name.trim(),games:[...a.games]},level:1,xp:0,experience:experienceConfig(a) }; }
function readAnswers(value: unknown): Answers {
 const result = {...initialAnswers,games:[] as string[]};
 if (!value || typeof value !== 'object') return result;
 const source = value as Record<string,unknown>;
 for (const field of Object.keys(initialAnswers) as (keyof Answers)[]) {
  if(field === 'games') { if(Array.isArray(source.games)) result.games=source.games.filter((x): x is string => typeof x === 'string'); }
  else if(typeof source[field] === 'string') result[field]=source[field] as string;
 }
 return result;
}
export function loadSession(): Session {
 const fallback: Session = { answers:{...initialAnswers,games:[]},step:0,screen:'welcome' };
 try {
  const raw=JSON.parse(localStorage.getItem('trikup-onboarding-v1') ?? 'null');
  if(!raw || typeof raw !== 'object') return fallback;
  const answers=readAnswers(raw.answers);
  const invalid=Array.from({length:8},(_,i)=>i).find(i=>!validStep(answers,i));
  const step=Math.min(Number.isInteger(raw.step)?Math.max(0,Math.min(7,raw.step)):0,invalid??7);
  const screen: Session['screen']=['welcome','onboarding','complete','adventure'].includes(raw.screen)?raw.screen:'welcome';
  const p=readAnswers(raw.profile?.answers);
  const profile=Array.from({length:8},(_,i)=>validStep(p,i)).every(Boolean)?createProfile(p):undefined;
  return {answers,step,screen:(screen==='complete'||screen==='adventure')&&invalid!==undefined?'onboarding':screen,profile};
 } catch { return fallback; }
}
export function saveSession(session: Session): boolean { try { localStorage.setItem('trikup-onboarding-v1',JSON.stringify(session)); return true; } catch { return false; } }
