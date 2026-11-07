import type { CatalogCourse } from "./types";
import { programmingDemo } from "../learning-map/programming-data";
export { programmingDemo } from "../learning-map/programming-data";

const systems = 'Ingeniería de Sistemas';
export const courseCatalog: CatalogCourse[] = [
  { id: 'demo-programming-1', name: 'Programación I', career: systems, demoCycle: '2', description: '17 semanas de POO, control de flujo, métodos, arreglos y archivos.', topics: ['POO', 'Estructuras de control', 'Métodos', 'Arreglos y cadenas', 'Excepciones', 'Archivos', 'Recursividad'], map: programmingDemo },
  { id: 'demo-calculus-1', name: 'Cálculo I', career: systems, demoCycle: '1', description: 'Conceptos introductorios de cambio y continuidad.', topics: ['Funciones', 'Límites', 'Derivadas'] },
  { id: 'demo-programming-2', name: 'Programación II', career: systems, demoCycle: '2', description: 'Organización del código y programación orientada a objetos.', topics: ['Clases', 'Objetos', 'Encapsulación'] },
  { id: 'demo-discrete', name: 'Matemática Discreta', career: systems, demoCycle: '2', description: 'Lenguajes formales para razonar sobre problemas.', topics: ['Lógica proposicional', 'Conjuntos', 'Grafos'] },
  { id: 'demo-databases', name: 'Base de Datos', career: systems, demoCycle: '4', description: 'Cómo representar y consultar información relacionada.', topics: ['Modelo relacional', 'Claves', 'Consultas SQL'] },
  { id: 'demo-networks', name: 'Redes de Computadoras', career: systems, demoCycle: '5', description: 'Una introducción a la comunicación entre equipos.', topics: ['Capas de red', 'Direccionamiento IP', 'TCP y UDP'] },
  { id: 'demo-software', name: 'Ingeniería de Software', career: systems, demoCycle: '5', description: 'Del problema a los requisitos y la validación.', topics: ['Requisitos', 'Diseño', 'Pruebas'] },
  { id: 'demo-os', name: 'Sistemas Operativos', career: systems, demoCycle: '6', description: 'Recursos y procesos en un sistema de cómputo.', topics: ['Procesos', 'Memoria', 'Archivos'] },
  { id: 'demo-ai', name: 'Inteligencia Artificial', career: systems, demoCycle: '8', description: 'Conceptos iniciales de búsqueda y aprendizaje.', topics: ['Búsqueda', 'Datos de entrenamiento', 'Evaluación'] },
  { id: 'demo-admin', name: 'Fundamentos de Administración', career: 'Administración', demoCycle: '1', description: 'Ejemplo introductorio sobre la organización del trabajo.', topics: ['Planificación', 'Organización', 'Control'] },
  { id: 'demo-psychology', name: 'Introducción a la Psicología', career: 'Psicología', demoCycle: '1', description: 'Ejemplo de introducción a métodos de investigación.', topics: ['Observación', 'Hipótesis', 'Ética de investigación'] },
  { id: 'demo-accounting', name: 'Contabilidad General', career: 'Contabilidad', demoCycle: '1', description: 'Ejemplo inicial de conceptos contables.', topics: ['Activo', 'Pasivo', 'Patrimonio'] },
];

export const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();

export function filterCatalog(query: string, career: string, cycle: string): CatalogCourse[] {
  const needle = normalizeSearch(query);
  return courseCatalog.filter(course => (!career || course.career === career) && (!cycle || course.demoCycle === cycle) && normalizeSearch(course.name).includes(needle));
}
