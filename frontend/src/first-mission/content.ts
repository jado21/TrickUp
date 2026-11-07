export const FIRST_NODE_ID = 'pi17-w01-n1';
export const MISSION_TITLE = 'Introducción a la Programación Orientada a Objetos';
export type ConceptId = 'class' | 'object' | 'attribute' | 'method';
export type Concept = { id: ConceptId; title: string; definition: string; example: string; hint: string };
export const concepts: Concept[] = [
  { id: 'class', title: 'Clase', definition: 'Plantilla que define atributos y comportamientos.', example: 'Gato es una clase: describe cómo serán sus objetos.', hint: 'Piensa en un molde reutilizable, no en un ejemplar concreto.' },
  { id: 'object', title: 'Objeto', definition: 'Instancia concreta de una clase.', example: 'Lucho es un gato concreto: un objeto de la clase Gato.', hint: 'Tiene identidad propia: es un ejemplar concreto.' },
  { id: 'attribute', title: 'Atributo', definition: 'Característica o dato de un objeto.', example: 'nombre y edad son datos que describen a un gato.', hint: 'Es información sobre cómo es o qué tiene el objeto.' },
  { id: 'method', title: 'Método', definition: 'Acción o comportamiento definido en una clase.', example: 'Maullar() representa algo que un gato puede hacer.', hint: 'Piensa en una acción que el objeto puede realizar.' },
];
export type MemoryCard = { id: string; concept: ConceptId; side: 'term' | 'definition'; text: string };
export const memoryCards: MemoryCard[] = concepts.flatMap(concept => [
  { id: `${concept.id}-term`, concept: concept.id, side: 'term' as const, text: concept.title },
  { id: `${concept.id}-definition`, concept: concept.id, side: 'definition' as const, text: concept.definition },
]);

export const rainQuestions: { id: string; question: string; answer: ConceptId; explanation: string; hint: string }[] = [
  { id: 'template', question: '¿Qué elemento funciona como plantilla para crear objetos?', answer: 'class', explanation: 'La clase define los atributos y comportamientos que tendrán sus instancias.', hint: 'Busca el concepto que describe un molde reutilizable.' },
  { id: 'feature', question: '¿Qué representa una característica de un objeto?', answer: 'attribute', explanation: 'Un atributo representa un dato o característica, como el nombre o la edad.', hint: 'No buscamos una acción: buscamos un dato que describa al objeto.' },
  { id: 'action', question: '¿Qué representa una acción de un objeto?', answer: 'method', explanation: 'Un método define un comportamiento, como Maullar().', hint: 'Busca el concepto relacionado con hacer algo.' },
];

export const codeBlocks = [
  { id: 'class-header', code: 'class Gato', explanation: 'Gato es la clase, el molde para crear objetos.' },
  { id: 'class-open', code: '{', explanation: 'Esta llave abre el cuerpo de la clase.' },
  { id: 'attribute', code: '    public string Nombre;', explanation: 'Nombre es un campo público de tipo string; representa un atributo del objeto.' },
  { id: 'method-header', code: '    public void Maullar()', explanation: 'Maullar es un método que no devuelve un valor (void).' },
  { id: 'method-open', code: '    {', explanation: 'Esta llave abre el cuerpo del método.' },
  { id: 'method-body', code: '        Console.WriteLine("Miau");', explanation: 'El método escribe Miau en la consola.' },
  { id: 'method-close', code: '    }', explanation: 'Esta llave cierra el método.' },
  { id: 'class-close', code: '}', explanation: 'La última llave cierra la clase.' },
] as const;
export type CodeBlockId = typeof codeBlocks[number]['id'];
export const expectedCodeOrder: CodeBlockId[] = codeBlocks.map(block => block.id);
export const fullCode = codeBlocks.map(block => block.code).join('\n');
export const gameDefinitions = [
  { id: 'memory', name: 'Memoria de conceptos', shortName: 'MEMORIA', maxXp: 30, minimumXp: 10, mistakeCost: 2, hintCost: 2 },
  { id: 'rain', name: 'Lluvia de conceptos', shortName: 'LLUVIA', maxXp: 30, minimumXp: 10, mistakeCost: 3, hintCost: 2 },
  { id: 'builder', name: 'Constructor de código', shortName: 'CONSTRUCTOR', maxXp: 40, minimumXp: 15, mistakeCost: 4, hintCost: 3 },
] as const;
export type GameId = typeof gameDefinitions[number]['id'];
