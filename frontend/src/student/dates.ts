export const LEARNING_TIME_ZONE = 'America/Lima';
export const validTimestamp = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && validDay(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
export function localDay(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: LEARNING_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (name: string) => parts.find(p => p.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function validDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
export const dayNumber = (day: string) => Math.floor(Date.parse(`${day}T12:00:00Z`) / 86400000);
/** Recalculate UI after midnight; never records learning activity. Uses Intl rather than a fixed UTC offset. */
export function millisecondsUntilNextLocalDay(now = new Date()): number {
  const day = localDay(now); let low = now.valueOf(); let high = low + 27 * 3600000;
  while (high - low > 1000) { const middle = Math.floor((low + high) / 2); if (localDay(new Date(middle)) === day) low = middle; else high = middle; }
  return Math.max(1000, high - now.valueOf() + 1000);
}
export function shiftDay(day: string, offset: number): string { return new Date((dayNumber(day) + offset) * 86400000 + 43200000).toISOString().slice(0, 10); }
export function formatDate(value: string | null | undefined): string {
  if (!value) return 'Fecha no registrada';
  const date = validDay(value) ? new Date(`${value}T17:00:00Z`) : new Date(value);
  return Number.isFinite(date.valueOf()) ? new Intl.DateTimeFormat('es-PE', { timeZone: LEARNING_TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric' }).format(date) : 'Fecha no registrada';
}
