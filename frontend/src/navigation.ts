export type AppScreen = 'welcome' | 'onboarding' | 'complete' | 'dashboard' | 'settings' | 'adventure' | 'map' | 'mission';
export const routeFor = (screen: AppScreen): string => ({ welcome: '#/', onboarding: '#/onboarding', complete: '#/profile', dashboard: '#/dashboard', settings: '#/settings', adventure: '#/courses', map: '#/courses/map', mission: '#/courses/map/poo' })[screen];
export function resolveScreen(hash: string, fallback: AppScreen, hasProfile: boolean): AppScreen {
  const requested = hash === '#/dashboard' ? 'dashboard' : hash === '#/settings' ? 'settings' : hash === '#/courses/map/poo' ? 'mission' : hash === '#/courses/map' ? 'map' : hash === '#/courses' ? 'adventure' : hash === '#/profile' ? 'complete' : hash === '#/onboarding' ? 'onboarding' : hash === '#/' ? 'welcome' : fallback;
  return ['dashboard', 'settings', 'mission', 'map', 'adventure', 'complete'].includes(requested) && !hasProfile ? 'onboarding' : requested;
}
