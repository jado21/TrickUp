import type { DemoMap } from '../courses/types';
import type { LearningMap, LearningWeek, LearningNode } from './types';

type Lesson = [title: string, objective: string];
function week(number: number, title: string, lessons: [Lesson, Lesson, Lesson, Lesson], exam = false): LearningWeek {
  const types: LearningNode['type'][] = ['explore', 'practice', 'apply', 'challenge'];
  const rewards = [10, 15, 20, exam ? 40 : 30];
  return { id: `pi17-week-${number}`, number, title, exam, nodes: lessons.map(([name, objective], index) => ({ id: `pi17-w${String(number).padStart(2, '0')}-n${index + 1}`, title: name, objective, expectedXp: number === 1 && index === 0 ? 100 : rewards[index], type: types[index] })) as LearningWeek['nodes'] };
}

/** Authored from the supplied syllabus and the user's 17-week pedagogical outline. */
export const programmingLearningMap: LearningMap = {
  id: 'programming-i-17-weeks', version: 1, courseName: 'Programación I', cycle: '2', courseCode: 'II0206',
  notice: 'Mapa precargado basado en el sílabo de referencia de Programación I (segundo ciclo). Los cuatro subniveles por semana, sus objetivos, los repasos y la consolidación de la semana 13 son adaptaciones pedagógicas de TriKUp; no son una transcripción literal ni un análisis automático del PDF cargado.',
  weeks: [
    week(1, 'Introducción a la programación', [
      ['Introducción a POO', 'Reconocer los conceptos básicos de POO y distinguir clases, objetos, atributos y métodos.'],
      ['Componentes y organización del computador', 'Distinguir procesador, memoria y dispositivos de entrada y salida y explicar su colaboración.'],
      ['Lenguajes de programación y sistemas operativos', 'Diferenciar la función de un lenguaje de programación de la función del sistema operativo.'],
      ['Desafío de fundamentos', 'Relacionar un problema sencillo con los elementos del computador y una solución orientada a objetos.'],
    ]),
    week(2, 'Clases y objetos', [
      ['Clases y objetos', 'Diferenciar una clase de sus instancias mediante un ejemplo de modelado.'],
      ['Datos y mensajes', 'Identificar el estado de un objeto y las operaciones mediante las que interactúa.'],
      ['Abstracción y encapsulamiento', 'Seleccionar los atributos relevantes y proponer una interfaz que proteja el estado interno.'],
      ['Herencia y polimorfismo', 'Explicar cómo una jerarquía permite compartir comportamiento y especializar operaciones.'],
    ]),
    week(3, 'Componentes de un programa', [
      ['Variables y constantes', 'Distinguir valores que cambian durante la ejecución de valores que deben permanecer constantes.'],
      ['Datos y operadores', 'Elegir tipos de datos y operadores adecuados para representar y transformar información.'],
      ['Expresiones e instrucciones', 'Interpretar la evaluación de una expresión y el efecto de una instrucción en un algoritmo.'],
      ['Bucles y desafío integrador', 'Seguir paso a paso un algoritmo repetitivo que combine variables, operadores e instrucciones.'],
    ]),
    week(4, 'Estructuras de control I', [
      ['Condicional simple', 'Plantear una acción que se ejecute únicamente cuando se cumple una condición.'],
      ['Condicional doble', 'Elegir entre dos acciones mutuamente excluyentes usando una condición booleana.'],
      ['Condicional múltiple', 'Organizar decisiones con varias alternativas sin dejar casos relevantes sin atender.'],
      ['Desafío de selección', 'Justificar la estructura de selección de un algoritmo y verificar sus casos límite.'],
    ]),
    week(5, 'Estructuras de control II', [
      ['Iteraciones simples', 'Definir el inicio, la condición de repetición y la actualización de un ciclo.'],
      ['Iteraciones anidadas', 'Describir cómo se ejecuta un ciclo interno por cada iteración del ciclo externo.'],
      ['Contadores y centinelas', 'Distinguir una repetición controlada por cantidad de otra terminada por un valor centinela.'],
      ['Precondiciones y postcondiciones', 'Comparar ciclos que evalúan su condición antes y después del cuerpo e identificar cuándo se ejecutan.'],
    ]),
    week(6, 'Programación modular', [
      ['Introducción a métodos', 'Dividir un problema en operaciones pequeñas con responsabilidades definidas.'],
      ['Definición de argumentos', 'Relacionar los argumentos de una llamada con los parámetros declarados por un método.'],
      ['Parámetros por valor y referencia', 'Distinguir los efectos esperados de pasar un valor y de permitir modificar una referencia.'],
      ['Implementación de métodos', 'Diseñar un método con entradas, una operación clara y un resultado verificable.'],
    ]),
    week(7, 'Métodos y constructores', [
      ['Llamadas por valor', 'Seguir el efecto de una llamada por valor sobre el parámetro y el dato original.'],
      ['Llamadas por referencia', 'Explicar cuándo una operación puede modificar el dato del llamador mediante un parámetro por referencia.'],
      ['Constructores', 'Proponer un constructor que deje un objeto en un estado inicial válido.'],
      ['Destructores', 'Reconocer el propósito de la finalización de objetos y diferenciarla de la liberación determinista de recursos.'],
    ]),
    week(8, 'Examen parcial', [
      ['Repaso de POO', 'Relacionar clases, objetos, encapsulamiento, herencia y polimorfismo en un mismo modelo.'],
      ['Repaso de estructuras de control', 'Seleccionar condicionales y ciclos adecuados para resolver problemas breves.'],
      ['Repaso de programación modular', 'Organizar una solución mediante métodos y justificar sus parámetros.'],
      ['Simulacro de examen parcial', 'Integrar fundamentos, control de flujo y métodos en una solución explicada paso a paso.'],
    ], true),
    week(9, 'Arreglos', [
      ['Definiciones', 'Explicar cómo un arreglo organiza elementos accesibles mediante índices.'],
      ['Operaciones con arreglos', 'Describir recorridos, consultas y actualizaciones respetando los límites de los índices.'],
      ['Vectores', 'Plantear un recorrido de un arreglo unidimensional para calcular un resultado agregado.'],
      ['Matrices', 'Relacionar filas y columnas con los dos índices de un arreglo bidimensional.'],
    ]),
    week(10, 'Cadenas de caracteres', [
      ['Definiciones', 'Representar texto como una secuencia de caracteres e identificar su longitud.'],
      ['Funciones de cadenas', 'Elegir operaciones de texto apropiadas para consultar y transformar una cadena.'],
      ['Extracción y comparación', 'Describir cómo obtener un fragmento y comparar cadenas según el criterio requerido.'],
      ['Concatenación', 'Construir un texto combinando fragmentos y explicar el resultado obtenido.'],
    ]),
    week(11, 'Excepciones y punteros', [
      ['Introducción a excepciones', 'Diferenciar un resultado esperado de una condición excepcional durante la ejecución.'],
      ['Propiedades de las excepciones', 'Identificar la información necesaria para describir y manejar un error de ejecución.'],
      ['Implementación de excepciones', 'Diseñar una respuesta controlada ante una operación que puede fallar.'],
      ['Introducción y aplicación de punteros', 'Reconocer el concepto de dirección de memoria y explicar un uso conceptual de punteros.'],
    ]),
    week(12, 'Archivos y flujos', [
      ['Introducción a archivos y flujos', 'Distinguir la información persistente de un archivo del flujo que permite leerla o escribirla.'],
      ['Jerarquía de datos', 'Relacionar campos, registros y archivos en una organización sencilla de información.'],
      ['Clases de archivos', 'Diferenciar archivos de texto y binarios según la representación de sus datos.'],
      ['Organización y formas de acceso', 'Comparar el acceso secuencial y el acceso directo según el problema a resolver.'],
    ]),
    week(13, 'Consolidación de archivos', [
      ['Organización de archivos', 'Proponer una estructura de registros coherente para guardar información de un problema.'],
      ['Acceso a datos', 'Seleccionar una estrategia de acceso adecuada para consultar los registros almacenados.'],
      ['Creación y lectura', 'Ordenar los pasos de apertura, creación o lectura y cierre de un archivo.'],
      ['Práctica de consolidación', 'Explicar una solución que registre y recupere datos manteniendo su estructura.'],
    ]),
    week(14, 'Operaciones con archivos', [
      ['Grabación de datos', 'Describir una operación de escritura que respete el formato de los registros.'],
      ['Acceso a datos almacenados', 'Plantear una búsqueda de información guardada y definir qué hacer si no existe.'],
      ['Operaciones con archivos', 'Organizar lectura y escritura considerando el cierre de recursos y los errores posibles.'],
      ['Desafío de archivos', 'Integrar almacenamiento y consulta de registros en una solución documentada.'],
    ]),
    week(15, 'Recursividad', [
      ['Conceptos básicos', 'Reconocer una solución que resuelve un problema mediante versiones más pequeñas del mismo.'],
      ['Casos base', 'Definir una condición de terminación y explicar por qué evita llamadas infinitas.'],
      ['Llamadas recursivas', 'Seguir la secuencia de llamadas y retornos en un ejemplo recursivo acotado.'],
      ['Desafío práctico', 'Proponer una solución recursiva justificando el caso base y el avance hacia él.'],
    ]),
    week(16, 'Examen final', [
      ['Repaso de arreglos y cadenas', 'Seleccionar operaciones de arreglos y texto para transformar una colección de datos.'],
      ['Repaso de excepciones', 'Identificar errores de ejecución y proponer su manejo sin ocultarlos.'],
      ['Repaso de archivos y recursividad', 'Relacionar persistencia de datos y descomposición recursiva con problemas adecuados.'],
      ['Simulacro final', 'Planificar una solución integradora y explicar las decisiones de datos, control y modularidad.'],
    ], true),
    week(17, 'Examen sustitutorio', [
      ['Diagnóstico de conocimientos', 'Identificar qué conceptos del curso puedes explicar y cuáles requieren repaso.'],
      ['Refuerzo de temas', 'Elegir contenidos para reforzar a partir de dificultades concretas observadas.'],
      ['Práctica mixta', 'Relacionar objetos, control de flujo, arreglos y archivos en problemas variados.'],
      ['Simulacro sustitutorio', 'Revisar una solución global y justificar sus resultados y casos límite.'],
    ], true),
  ],
};

const kinds = ['DISCOVER', 'PRACTICE', 'APPLY', 'PROVE'] as const;
export const programmingDemo: DemoMap = {
  courseName: programmingLearningMap.courseName,
  notice: programmingLearningMap.notice,
  references: [],
  weeks: programmingLearningMap.weeks.map(w => ({
    id: w.id, title: w.title, topics: w.nodes.map(n => n.title), objectives: w.nodes.map(n => n.objective),
    sublevels: w.nodes.map((node, i) => ({ kind: kinds[i], title: node.title, activity: node.objective })) as DemoMap['weeks'][number]['sublevels'],
  })),
};
