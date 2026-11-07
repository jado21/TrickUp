export type Answers = {
  name: string;
  career: string;
  otherCareer: string;
  otherCycle: string;
  cycle: string;
  goal: string;
  motivation: string;
  difficulty: string;
  games: string[];
  time: string;
  tone: string;
};

export type Option = {
  id: string;
  title: string;
  description?: string;
  icon: IconName;
  preview?: string;
};

export type IconName =
  | "trophy"
  | "target"
  | "book"
  | "chart"
  | "bolt"
  | "flag"
  | "compass"
  | "gem"
  | "sword"
  | "light"
  | "steps"
  | "pause"
  | "cards"
  | "puzzle"
  | "clock"
  | "blocks"
  | "brain"
  | "heart"
  | "fire"
  | "spark"
  | "leaf";

export const initialAnswers: Answers = {
  name: "",
  career: "",
  otherCareer: "",
  otherCycle: "",
  cycle: "",
  goal: "",
  motivation: "",
  difficulty: "",
  games: [],
  time: "",
  tone: "",
};

export const goals: Option[] = [
  { id: "pass_courses", title: "Aprobar mis cursos", icon: "trophy" },
  { id: "exam_prep", title: "Prepararme para mis exámenes", icon: "target" },
  { id: "master_knowledge", title: "Dominar nuevos conocimientos", icon: "book" },
  {
    id: "improve_performance",
    title: "Mejorar mi rendimiento académico",
    icon: "chart",
  },
];

export const motivations: Option[] = [
  { id: "personal_records", title: "Superar mis propios récords", icon: "bolt" },
  {
    id: "competition",
    title: "Competir y alcanzar nuevas metas", description: "Un nuevo desafío para dar lo mejor.",
    icon: "flag",
  },
  { id: "discovery", title: "Descubrir nuevos conocimientos", description: "Aprender algo nuevo en cada misión.", icon: "compass" },
  {
    id: "rewards",
    title: "Conseguir recompensas y logros", description: "Celebrar cada victoria del camino.",
    icon: "gem",
  },
];

export const difficulties: Option[] = [
  { id: "persist", title: "Insisto hasta resolverlo", icon: "sword" },
  { id: "hints", title: "Prefiero recibir pistas", icon: "light" },
  {
    id: "guided",
    title: "Busco una explicación paso a paso",
    icon: "steps",
  },
  {
    id: "break",
    title: "Cambio de actividad y vuelvo después",
    icon: "pause",
  },
];

export const gameOptions: Option[] = [
  { id: "MEMORY_MATCH", title: "Juegos de memoria", icon: "cards" },
  { id: "ORDER_SEQUENCE", title: "Puzles y ordenamiento", icon: "puzzle" },
  { id: "MULTIPLE_CHOICE", title: "Juegos rápidos y contrarreloj", icon: "clock" },
  { id: "FILL_BLANK", title: "Construcción y ordenamiento", icon: "blocks" },
  { id: "FALLING_TILES", title: "Desafíos de lógica", icon: "brain" },
];

export const timeOptions: Option[] = [
  {
    id: "short",
    title: "10 a 15 minutos diarios",
    description: "Una misión breve",
    icon: "bolt",
  },
  {
    id: "medium",
    title: "20 a 30 minutos diarios",
    description: "Una aventura equilibrada",
    icon: "clock",
  },
  {
    id: "long",
    title: "45 minutos diarios",
    description: "Modo concentración",
    icon: "fire",
  },
  {
    id: "flexible",
    title: "Prefiero decidir cada día",
    description: "Ritmo flexible",
    icon: "compass",
  },
];

export const toneOptions: Option[] = [
  { id: 'disciplined', title: 'Disciplinado', description: 'Objetivos claros y pasos estructurados', icon: 'flag', preview: 'Tu siguiente misión está preparada. Avanza una actividad a la vez.' },
  {
    id: "friendly",
    title: "Amigable",
    description: "Mensajes positivos y cercanos",
    icon: "heart",
    preview: "¡Buen avance! Cada paso te acerca a completar tu misión.",
  },
  {
    id: "competitive",
    title: "Competitivo",
    description: "Desafíos para superar récords",
    icon: "trophy",
    preview: "Tu mejor marca sigue ahí. ¿Listo para llevarla al siguiente nivel?",
  },
  {
    id: "humorous",
    title: "Humorístico",
    description: "Bromas y sarcasmo ligero",
    icon: "spark",
    preview: "¿Y así piensas aprobar el parcial? Tu misión te está esperando.",
  },
  {
    id: "calm",
    title: "Tranquilo",
    description: "Recordatorios breves y sin presión",
    icon: "leaf",
    preview: "Cuando estés listo, hay una misión corta esperándote.",
  },
];

export const careerOptions = ["Ingeniería de Sistemas", "Ingeniería de Software", "Ingeniería Informática", "Ingeniería Industrial", "Administración", "Contabilidad", "Economía", "Medicina", "Derecho", "Psicología", "Otra"];

export const stepMeta = [
  ["IDENTIDAD", "¿Cómo quieres que te llamemos?", "Elige el nombre que verás durante tu aventura."],
  [
    "RUTA ACADÉMICA",
    "¿Cuál es tu aventura académica?",
    "Cuéntanos qué estás estudiando para preparar tu punto de partida.",
  ],
  ["OBJETIVO", "¿Cuál es tu misión principal?", "Elige el resultado que más te gustaría alcanzar."],
  [
    "MOTIVACIÓN",
    "¿Qué te impulsa a seguir avanzando?",
    "No hay respuestas correctas: elige lo que más se parece a ti.",
  ],
  [
    "ESTRATEGIA",
    "¿Qué haces cuando un desafío se complica?",
    "Esto nos ayudará a adaptar el ritmo de las misiones.",
  ],
  [
    "TIPO DE DESAFÍO",
    "¿Qué tipo de desafíos disfrutas más?",
    "Selecciona hasta dos estilos de juego.",
  ],
  [
    "DISPONIBILIDAD",
    "¿Cuánto tiempo quieres dedicar a tu aventura?",
    "Podrás ajustar este ritmo cuando lo necesites.",
  ],
  [
    "ACOMPAÑAMIENTO",
    "¿Cómo quieres que TriKUp te motive?",
    "Elige el tono de tus mensajes. Podrás cambiarlo después.",
  ],
];


