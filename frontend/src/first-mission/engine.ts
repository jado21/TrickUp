import { codeBlocks, concepts, expectedCodeOrder, gameDefinitions, memoryCards, rainQuestions, type CodeBlockId, type ConceptId, type GameId } from './content';

export type Feedback = { correct: boolean; explanation: string; hint: string; concept: string };
export type GameStats = { attempts: number; mistakes: number; hintsUsed: number; completed: boolean; xp: number };
export type MissionPhase = 'intro' | GameId | 'complete';
export type MissionState = {
  phase: MissionPhase;
  memory: { matched: ConceptId[]; open: string[]; feedback: Feedback | null; stats: GameStats };
  rain: { questionIndex: number; selected: ConceptId | null; feedback: Feedback | null; stats: GameStats };
  builder: { order: CodeBlockId[]; feedback: Feedback | null; stats: GameStats };
};
export type MissionAction =
  | { type: 'start' }
  | { type: 'flip'; cardId: string }
  | { type: 'answer-rain'; answerId: ConceptId }
  | { type: 'move-block'; blockId: CodeBlockId; target: number }
  | { type: 'check-code' }
  | { type: 'hint'; game: GameId }
  | { type: 'continue' };

const emptyStats = (): GameStats => ({ attempts: 0, mistakes: 0, hintsUsed: 0, completed: false, xp: 0 });
export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
export function gameScore(game: GameId, mistakes: number, hints: number): number {
  const rule = gameDefinitions.find(definition => definition.id === game)!;
  return Math.max(rule.minimumXp, rule.maxXp - Math.max(0, mistakes) * rule.mistakeCost - Math.max(0, hints) * rule.hintCost);
}
export function initialMission(builderOrder: CodeBlockId[]): MissionState {
  return { phase: 'intro', memory: { matched: [], open: [], feedback: null, stats: emptyStats() }, rain: { questionIndex: 0, selected: null, feedback: null, stats: emptyStats() }, builder: { order: [...builderOrder], feedback: null, stats: emptyStats() } };
}
export function evaluatePair(firstId: string, secondId: string): Feedback & { conceptId?: ConceptId } {
  const first = memoryCards.find(card => card.id === firstId);
  const second = memoryCards.find(card => card.id === secondId);
  const correct = !!first && !!second && first.id !== second.id && first.concept === second.concept && first.side !== second.side;
  const target = concepts.find(concept => concept.id === first?.concept);
  return { correct, conceptId: correct ? first!.concept : undefined, concept: target?.title ?? 'Conceptos de POO', explanation: correct ? `${target!.title}: ${target!.definition} ${target!.example}` : first?.side === second?.side ? 'Una pareja necesita un concepto y su definición. Estas dos cartas son del mismo tipo.' : 'Este concepto y esta definición no corresponden. Compara si hablan de una plantilla, un ejemplar, un dato o una acción.', hint: target?.hint ?? 'Busca una carta de concepto y la definición que le corresponde.' };
}
export function evaluateRain(index: number, answerId: string): Feedback {
  const question = rainQuestions[index];
  const correct = !!question && question.answer === answerId;
  return { correct, explanation: correct ? question.explanation : 'Esta opción no describe lo que pregunta el enunciado. Distingue el molde, el ejemplar, sus datos y sus acciones.', hint: question?.hint ?? '', concept: concepts.find(concept => concept.id === question?.answer)?.title ?? 'POO' };
}
export function evaluateCode(order: readonly string[]): Feedback {
  const correct = order.length === expectedCodeOrder.length && order.every((id, index) => id === expectedCodeOrder[index]);
  const firstMismatch = order.findIndex((id, index) => id !== expectedCodeOrder[index]);
  return { correct, concept: 'Clase, atributo y método', explanation: correct ? 'La clase Gato contiene el atributo Nombre y el método Maullar(). Las llaves delimitan la clase y el método.' : `El orden todavía no forma la clase esperada. Revisa desde el bloque ${Math.max(0, firstMismatch) + 1} y comprueba qué elemento contiene a los demás.`, hint: 'La clase contiene al atributo y al método. El método contiene la instrucción de consola; cada apertura tiene su cierre.' };
}
function attempted(stats: GameStats, correct: boolean, game: GameId, completed: boolean): GameStats {
  const next = { ...stats, attempts: stats.attempts + 1, mistakes: stats.mistakes + (correct ? 0 : 1), completed };
  return { ...next, xp: completed ? gameScore(game, next.mistakes, next.hintsUsed) : 0 };
}

/** All grading is based on stable identifiers. UI timing, theory and audio never affect scoring. */
export function reduceMission(state: MissionState, action: MissionAction): MissionState {
  if (action.type === 'start') return state.phase === 'intro' ? { ...state, phase: 'memory' } : state;
  if (action.type === 'hint') {
    if (state.phase !== action.game || state[action.game].stats.completed) return state;
    const game = state[action.game];
    return { ...state, [action.game]: { ...game, stats: { ...game.stats, hintsUsed: game.stats.hintsUsed + 1 } } };
  }
  if (action.type === 'flip') {
    const memory = state.memory;
    const card = memoryCards.find(item => item.id === action.cardId);
    if (state.phase !== 'memory' || !card || memory.feedback || memory.stats.completed || memory.open.includes(card.id) || memory.matched.includes(card.concept)) return state;
    const open = [...memory.open, card.id];
    if (open.length < 2) return { ...state, memory: { ...memory, open } };
    const feedback = evaluatePair(open[0], open[1]);
    const matched = feedback.correct ? [...memory.matched, feedback.conceptId!] : memory.matched;
    return { ...state, memory: { open, matched, feedback, stats: attempted(memory.stats, feedback.correct, 'memory', matched.length === 4) } };
  }
  if (action.type === 'answer-rain') {
    const rain = state.rain;
    if (state.phase !== 'rain' || rain.feedback || rain.stats.completed || !concepts.some(concept => concept.id === action.answerId)) return state;
    const feedback = evaluateRain(rain.questionIndex, action.answerId);
    return { ...state, rain: { ...rain, selected: action.answerId, feedback, stats: attempted(rain.stats, feedback.correct, 'rain', feedback.correct && rain.questionIndex === rainQuestions.length - 1) } };
  }
  if (action.type === 'move-block') {
    const builder = state.builder;
    const index = builder.order.indexOf(action.blockId);
    if (state.phase !== 'builder' || builder.stats.completed || index < 0 || !Number.isInteger(action.target) || action.target < 0 || action.target >= builder.order.length || action.target === index) return state;
    const order = [...builder.order]; order.splice(index, 1); order.splice(action.target, 0, action.blockId);
    return { ...state, builder: { ...builder, order, feedback: null } };
  }
  if (action.type === 'check-code') {
    const builder = state.builder;
    if (state.phase !== 'builder' || builder.stats.completed || builder.feedback) return state;
    const feedback = evaluateCode(builder.order);
    return { ...state, builder: { ...builder, feedback, stats: attempted(builder.stats, feedback.correct, 'builder', feedback.correct) } };
  }
  if (action.type === 'continue') {
    if (state.phase === 'memory' && state.memory.feedback) return { ...state, phase: state.memory.stats.completed ? 'rain' : 'memory', memory: { ...state.memory, open: [], feedback: null } };
    if (state.phase === 'rain' && state.rain.feedback) return { ...state, phase: state.rain.stats.completed ? 'builder' : 'rain', rain: { ...state.rain, selected: null, feedback: null, questionIndex: state.rain.feedback.correct && !state.rain.stats.completed ? state.rain.questionIndex + 1 : state.rain.questionIndex } };
    if (state.phase === 'builder' && state.builder.feedback) return { ...state, phase: state.builder.stats.completed ? 'complete' : 'builder', builder: { ...state.builder, feedback: null } };
  }
  return state;
}

export const missionCompleted = (state: MissionState) => state.memory.stats.completed && state.rain.stats.completed && state.builder.stats.completed;
export const missionXp = (state: MissionState) => gameDefinitions.reduce((sum, game) => sum + state[game.id].stats.xp, 0);

export type MissionSession = { version: 1; runId: string; startedAt: string | null; updatedAt: string | null; completedAt: Partial<Record<GameId, string>>; memoryOrder: string[]; builderOrder: CodeBlockId[]; journal: MissionAction[]; state: MissionState };
export function createMissionSession(): MissionSession {
  const memoryOrder = shuffle(memoryCards.map(card => card.id));
  let builderOrder = shuffle(expectedCodeOrder);
  if (builderOrder.every((id, i) => id === expectedCodeOrder[i])) builderOrder = [...builderOrder.slice(1), builderOrder[0]];
  return { version: 1, runId: globalThis.crypto?.randomUUID?.() ?? `run-${Date.now()}-${Math.random().toString(36).slice(2)}`, startedAt: null, updatedAt: null, completedAt: {}, memoryOrder, builderOrder, journal: [], state: initialMission(builderOrder) };
}
export function applyAction(session: MissionSession, action: MissionAction, at: string | null = new Date().toISOString()): MissionSession {
  const state = reduceMission(session.state, action);
  if (state === session.state) return session;
  const completedAt = { ...session.completedAt };
  if (at) for (const game of gameDefinitions) if (!session.state[game.id].stats.completed && state[game.id].stats.completed) completedAt[game.id] = at;
  return { ...session, state, journal: [...session.journal, action], startedAt: session.startedAt ?? at, updatedAt: at ?? session.updatedAt, completedAt };
}
export function isMissionAction(value: unknown): value is MissionAction {
  if (!value || typeof value !== 'object') return false;
  const action = value as Record<string, unknown>;
  if (['start', 'continue', 'check-code'].includes(String(action.type))) return true;
  if (action.type === 'flip') return typeof action.cardId === 'string' && memoryCards.some(card => card.id === action.cardId);
  if (action.type === 'answer-rain') return concepts.some(concept => concept.id === action.answerId);
  if (action.type === 'hint') return gameDefinitions.some(game => game.id === action.game);
  if (action.type === 'move-block') return codeBlocks.some(block => block.id === action.blockId) && Number.isInteger(action.target) && Number(action.target) >= 0 && Number(action.target) < codeBlocks.length;
  return false;
}
