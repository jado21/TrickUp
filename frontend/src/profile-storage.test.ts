import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initialAnswers, type Answers } from './onboarding-data';
import { validStep, createProfile, loadSession, saveSession } from './profile-storage';
const full: Answers = {...initialAnswers,name:'Alex',career:'Ingeniería de Sistemas',cycle:'2',goal:'pass_courses',motivation:'personal_records',difficulty:'guided',games:['MEMORY_MATCH','FILL_BLANK'],time:'short',tone:'calm'};
beforeEach(()=> { const store=new Map<string,string>(); vi.stubGlobal('localStorage',{getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)}); });
describe('onboarding',()=>{
 it('validates all eight stages and rejects blank names',()=>{ expect(Array.from({length:8},(_,i)=>validStep(full,i))).toEqual(Array(8).fill(true)); expect(validStep({...full,name:'   '},0)).toBe(false); });
 it('requires custom academic details',()=>{ expect(validStep({...full,career:'Otra'},1)).toBe(false); expect(validStep({...full,career:'Otra',otherCareer:'Arte',cycle:'Otro',otherCycle:'Semestre 12'},1)).toBe(true); });
 it('limits games to two known distinct modes',()=>{ for(const games of [[],['bad'],['MEMORY_MATCH','MEMORY_MATCH'],['MEMORY_MATCH','FILL_BLANK','FALLING_TILES']]) expect(validStep({...full,games},5)).toBe(false); });
 it('persists stage, answers and completed profile',()=>{ saveSession({answers:full,step:6,screen:'complete',profile:createProfile(full)}); expect(loadSession().step).toBe(6); expect(loadSession().profile?.xp).toBe(0); expect(loadSession().answers).toEqual(full); });
 it('recovers from corrupt storage and disallows skipping required answers',()=>{ localStorage.setItem('trikup-onboarding-v1','{'); expect(loadSession().screen).toBe('welcome'); saveSession({answers:initialAnswers,step:7,screen:'complete'}); expect(loadSession().step).toBe(0); expect(loadSession().screen).toBe('onboarding'); });
 it('configures guided help and calm messages deterministically',()=>{ const p=createProfile(full); expect(p.experience.visibleHints).toBe(true); expect(p.experience.timersEnabled).toBe(false); expect(p.experience.gameModes).toEqual(full.games); });
 it('handles unavailable local storage',()=>{ vi.stubGlobal('localStorage',{getItem:()=>{throw Error();},setItem:()=>{throw Error();}}); expect(loadSession().step).toBe(0); expect(saveSession({answers:full,step:0,screen:'welcome'})).toBe(false); });
});
