# TriKUp

> Plataforma web con IA para estudiantes universitarios: te dice **qué aprender, en qué orden, cómo practicarlo y cuándo estudiarlo**.

**Equipo:** kAIzen · **Estado:** MVP en desarrollo (hackathon)

---

## ¿Qué es TriKUp?

Subes el sílabo de un curso y TriKUp lo convierte en un **mapa de aprendizaje por niveles**, con **misiones de práctica gamificadas** (XP y progreso). Además genera un **roadmap de habilidades** para tu especialización profesional y un **horario semanal de estudio** según tu tiempo disponible.

## Funciones principales

| Función | Descripción |
|---|---|
| **Mapa de aprendizaje inteligente** | Analiza el sílabo (PDF) y lo transforma en unidades y niveles visuales. Cada nivel tiene misiones de opción múltiple con retroalimentación. |
| **Roadmap inteligente de especialización** | Según tu carrera, ciclo, conocimientos previos e interés, propone una ruta de habilidades y herramientas por etapas. |
| **Tutor y planificador inteligente de estudio** | Prioriza temas y evaluaciones y propone un horario semanal realista, validado con reglas en Python. |

## Flujo principal del MVP

```
Sílabo PDF → Extracción de texto → Análisis con IA → Unidades y niveles (JSON) → Mapa visual → Misión
```
## Límites actuales del MVP

- Sin base de datos ni autenticación; el progreso se guarda en `localStorage`.
- Los PDFs no se almacenan; solo se procesan PDFs con texto extraíble (sin OCR).
- La clave de Gemini vive únicamente en el backend y nunca se sube al repositorio.
- Las rutas profesionales son orientativas y no garantizan empleo.
- El mapa generado no reemplaza el sílabo oficial del docente.

## Equipo

| Integrante | Rol |
|---|---|
| Alexander Zavala | Backend e IA |
| Jeremy Duran | Frontend y UX |
| Paolo Canelo | Pruebas, integración y presentación |
