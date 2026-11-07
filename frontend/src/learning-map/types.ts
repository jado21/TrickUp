export type ChallengeType = 'explore' | 'practice' | 'apply' | 'challenge';
export type LearningNode = { id: string; title: string; objective: string; expectedXp: number; type: ChallengeType };
export type LearningWeek = { id: string; number: number; title: string; exam: boolean; nodes: [LearningNode, LearningNode, LearningNode, LearningNode] };
export type LearningMap = { id: string; version: number; courseName: string; cycle: string; courseCode: string; notice: string; weeks: LearningWeek[] };
export type NodeState = 'locked' | 'unlocked' | 'current' | 'completed';
export type Completion = { nodeId: string; source: 'demo' | 'mission'; xp: number; runId?: string; completedAt?: string };
export type MapProgress = { mapId: string; mapVersion: number; completions: Completion[] };
