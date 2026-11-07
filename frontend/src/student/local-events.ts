export const STUDENT_DATA_EVENT = 'trikup:student-data';
export function announceStudentData(): void { if (typeof window !== 'undefined') window.dispatchEvent(new Event(STUDENT_DATA_EVENT)); }
