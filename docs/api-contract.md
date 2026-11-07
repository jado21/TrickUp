# Contrato REST TriKUp — revisión Prompt 3

Base local: `http://localhost:8000`. Todas las rutas están bajo `/api`.
Sin autenticación ni base de datos; misiones temporales en memoria. CORS: `http://localhost:3000`.
OpenAPI completo con tipos y restricciones: `GET /api/openapi.json`.
Swagger: `GET /api/docs`. Los modelos Pydantic son la fuente del contrato.

**Estado Prompt 3:** salud, sílabos y motor de misiones están implementados. El análisis
requiere Gemini configurado y devuelve 200 cuando la generación validada tiene éxito.
Roadmaps y planificador siguen devolviendo 501. Misiones están probadas con mocks;
no se realizó una llamada real de misiones en este Prompt 3.
Los ejemplos de generación son ilustrativos; no son registros de llamadas reales.
El contrato de sílabos se conserva; el placeholder de misiones cambia según el nuevo alcance. `/docs` y `/openapi.json` redirigen a
`/api/docs` y `/api/openapi.json`, respectivamente.

## Convenciones

- JSON UTF-8 con nombres `snake_case`; POST JSON exige `Content-Type: application/json`.
- Sílabo utiliza `multipart/form-data`, campo `file`; deja que el navegador defina el boundary.
- No hay envoltorio `data` en respuestas exitosas. Los errores usan `{ "error": ... }`.
- Propiedades no declaradas producen 422. Strings se recortan; los campos de texto
  tienen de 1 a 2000 caracteres después del recorte, salvo límites específicos
  documentados (por ejemplo source_text de misiones: 80–12000).
- Los campos sin valor por defecto son obligatorios. Misiones admite null solo en
  los campos opcionales documentados; los demás contratos conservan sus tipos.
- Los identificadores de unidades, niveles, preguntas y cursos son strings opacos;
  el frontend no debe depender de un formato específico. IDs únicos dentro de cada colección.
- Fechas `YYYY-MM-DD`; horas locales `HH:MM` o `HH:MM:00` (sin offset ni segundos
  distintos de cero). La serialización de horas devuelve `HH:MM:SS`.
- Para este MVP, el planificador solo admite `America/Lima`.
- Sin streaming, cookies, paginación ni almacenamiento permanente de archivos.

## GET /api/health

Sin parámetros ni cuerpo. No verifica conectividad con Gemini ni validez de claves.

200, esquema `HealthResponse`:

```json
{"status":"ok","service":"trikup-backend","version":"0.1.0"}
```

Los tres campos son strings constantes.

## POST /api/syllabus/analyze

Solicitud: `multipart/form-data`, campo obligatorio `file` de tipo archivo binario
PDF (MIME `application/pdf`). Se exige un único archivo y ningún campo adicional.
Máximo 5 MiB por PDF, 40 páginas y 60000 caracteres extraídos; cuerpo multipart
máximo 5 MiB + 64 KiB. Se rechazan PDFs dañados, protegidos con contraseña o sin
texto extraíble; no se realiza OCR. Sin otros parámetros ni persistencia permanente.
Se procesa con PyMuPDF y Gemini, y se valida antes de devolver el resultado.

```javascript
const form = new FormData();
form.append("file", pdfFile);
const response = await fetch("http://localhost:8000/api/syllabus/analyze", {
  method: "POST", body: form
});
const result = await response.json();
```

200, esquema `SyllabusResponse`:

```json
{
  "course_name":"Cálculo I",
  "summary":"Fundamentos de límites y derivadas.",
  "units":[{
    "id":"unit-1","title":"Límites",
    "levels":[{
      "id":"level-1","title":"Concepto de límite",
      "objectives":["Interpretar límites en una gráfica"]
    }]
  }]
}
```

`course_name`, `summary`: texto. `units`: array no vacío de `Unit`.
`Unit`: `id`, `title` texto y `levels` array no vacío de `Level`.
`Level`: `id`, `title` texto y `objectives` array no vacío de textos.
El resumen representa la descripción académica, los títulos de los niveles
representan los temas y el orden de los arrays conserva la progresión del sílabo.
No existen campos adicionales `description`, `topics` u `order`.
Los textos devueltos deben estar sustentados por extractos del PDF.
Véase [la guía operativa](syllabus-analysis.md) para tiempos y concurrencia.

## Misiones — Prompt 3

El nuevo alcance sustituye el placeholder de Fase 1: curso/tema no bastaban para
preguntas sustentadas y correct_option_index exponía la solución. Este cambio de
contrato está autorizado por el Prompt 3; no cambia el endpoint ni contrato de sílabos.
Jeremy debe usar las actividades discriminadas por modality, no el antiguo questions.

### POST /api/missions/generate

JSON MissionRequest. Requiere material académico adicional: los títulos/objetivos
del mapa no sustituyen teoría. El usuario puede pegar apuntes o una lectura en
source_text. Si no basta para generar actividades sustentadas, se devuelve 422.

| Campo | Tipo | Restricción / defecto |
|---|---|---|
| course_name, unit_title, level_title | string | Obligatorios, 1–2000 caracteres |
| level_id | string | Obligatorio, 1–128 caracteres |
| objectives | string[] | Obligatorio, 1–5 textos |
| source_text | string | Obligatorio, 80–12000 caracteres |
| activity_count | integer | 1–10, defecto 5; cubre todas las modalidades y objetivos |
| modalities | enum[] o null | Sin repetidos; si se omite usa perfil o las cinco modalidades |
| profile | StudentProfile o null | Opcional, esquema abajo |
| previous_mission_id | string o null | Opcional; continuación de misión completada del mismo contexto |

Ejemplo sintético para mocks, sin llamada real a Gemini:

```json
{
  "course_name": "Matemática",
  "unit_title": "Funciones",
  "level_id": "level-1",
  "level_title": "Dominio y rango",
  "objectives": [
    "Identificar dominio y rango"
  ],
  "source_text": "Una función relaciona cada entrada con una salida.\nEl dominio es el conjunto de entradas. El rango es el conjunto de salidas.\nPara estudiar una función, primero identifica el dominio.\nDespués calcula las imágenes. Finalmente describe el rango.",
  "activity_count": 5,
  "profile": {
    "study_area": "Ingeniería de Sistemas",
    "academic_level": "Universitario, ciclo 1",
    "learning_goal": "Comprender dominio y rango",
    "available_minutes": 20,
    "preferred_modalities": [
      "MULTIPLE_CHOICE",
      "FILL_BLANK",
      "MEMORY_MATCH",
      "ORDER_SEQUENCE",
      "FALLING_TILES"
    ],
    "motivation_tone": "friendly",
    "initial_knowledge": "beginner"
  }
}
```

200 MissionResponse. Este ejemplo también es sintético:

```json
{
  "mission_id": "IqQ477rVOEWSwWlxz-w_1_0NcEul6zt0f1gAZ87FEe4",
  "expires_at": "2026-11-07T16:36:35.270593Z",
  "course_name": "Matemática",
  "unit_title": "Funciones",
  "level_id": "level-1",
  "level_title": "Dominio y rango",
  "difficulty": "beginner",
  "activities": [
    {
      "id": "9qU4-Iib6u1KpUp1J2mZsQAz",
      "prompt": "¿Qué es el dominio?",
      "objective_index": 0,
      "max_xp": 10,
      "modality": "MULTIPLE_CHOICE",
      "options": [
        {
          "id": "7e-C0IsFQVo5zYuriE4CINrP",
          "text": "el promedio"
        },
        {
          "id": "d6tlfhBsADsprvsV9u1oE7Dp",
          "text": "el conjunto de salidas"
        },
        {
          "id": "kbIgP9iWgU4nx_YEqLxWNd5l",
          "text": "el conjunto de entradas"
        },
        {
          "id": "QxeGnBvljKNcfBmrHLBlL_km",
          "text": "un número negativo"
        }
      ]
    },
    {
      "id": "xuDwhNC6e0ueNVJoWxHIQrzp",
      "prompt": "El dominio de una función es ___.",
      "objective_index": 0,
      "max_xp": 12,
      "modality": "FILL_BLANK"
    },
    {
      "id": "OM7LcI1w9qDgKP-6wlG4OFTV",
      "prompt": "Relaciona los conceptos con el material.",
      "objective_index": 0,
      "max_xp": 16,
      "modality": "MEMORY_MATCH",
      "left_cards": [
        {
          "id": "p38PpUnYfk3R7utKNjiKZ-HY",
          "text": "rango"
        },
        {
          "id": "SZ1J5RmaHezuZnmdpmJ8n8UY",
          "text": "dominio"
        }
      ],
      "right_cards": [
        {
          "id": "Zgo0LvACzqX8WQPyOAQadmjk",
          "text": "el conjunto de salidas"
        },
        {
          "id": "jK7VM6ng3Zza_9XFHwcEApfj",
          "text": "el conjunto de entradas"
        }
      ]
    },
    {
      "id": "JfPgEAV5aU4wu2sEaji9PPmP",
      "prompt": "Ordena los pasos según el material.",
      "objective_index": 0,
      "max_xp": 14,
      "modality": "ORDER_SEQUENCE",
      "items": [
        {
          "id": "PNav8p1e7nBNbA1h_5YdbZe4",
          "text": "describe el rango"
        },
        {
          "id": "xuFnA7VOtUCC1b1NytWafwja",
          "text": "identifica el dominio"
        },
        {
          "id": "c_J1LKT1VnFmtu_-81b8n95_",
          "text": "calcula las imágenes"
        }
      ]
    },
    {
      "id": "xVYHJvpgE1PeF9Uez5d7ip_D",
      "prompt": "Selecciona los conjuntos mencionados en el material.",
      "objective_index": 0,
      "max_xp": 12,
      "modality": "FALLING_TILES",
      "tiles": [
        {
          "id": "_Zuq5RuBgxeGueplpPDQqrl3",
          "text": "el conjunto de salidas"
        },
        {
          "id": "zX2N7qQTQwrmrT4QK-We6QU8",
          "text": "el conjunto de entradas"
        },
        {
          "id": "esYLahrWgTtTA_s01VOBz3L-",
          "text": "el promedio numérico"
        }
      ]
    }
  ],
  "progress": {
    "answered": 0,
    "correct": 0,
    "total": 5,
    "xp": 0,
    "completed": false,
    "can_advance": false,
    "next_activity_id": "9qU4-Iib6u1KpUp1J2mZsQAz"
  }
}
```

mission_id e IDs de actividades/opciones/cartas/pasos/bloques son opacos y aleatorios.
expires_at es datetime UTC. Todas las actividades tienen id, modality, prompt,
objective_index (basado en cero) y max_xp. Se resuelven en orden, según progress.
La respuesta no incluye soluciones, explicaciones ni citas privadas.

| modality | Campos públicos específicos | answer del alumno |
|---|---|---|
| MULTIPLE_CHOICE | options: cuatro {id,text} | {modality, option_id} |
| FILL_BLANK | prompt con un único ___ | {modality, text} |
| MEMORY_MATCH | left_cards y right_cards: 2–6 {id,text} | {modality, pairs:[{left_id,right_id}]} |
| ORDER_SEQUENCE | items: 2–8 {id,text} desordenados | {modality, item_ids:[...]} |
| FALLING_TILES | tiles: 3–10 {id,text} mezclados | {modality, tile_ids:[...]} |

### GET /api/missions/{mission_id}

200 MissionResponse con progreso actual. No expone soluciones ni respuestas previas.
Guardar solo el ID en sessionStorage para recuperar la misión tras recargar la pestaña.

### POST /api/missions/answer

JSON AnswerRequest: mission_id, activity_id y answer según la tabla anterior.
No acepta correct, xp ni solution. Devuelve 200 FeedbackResponse:
mission_id, activity_id, correct, xp_awarded, replayed, feedback, explanation,
solution (misma unión que answer), accepted_answers (solo relevante para FILL_BLANK),
progress y adaptation. La solución se revela después del primer intento evaluable.
La evaluación es determinista y no utiliza Gemini.

[Ejemplos completos de entregas y feedback por modalidad](examples/missions-answer-examples.json).

- Una entrega evaluable por actividad. IDs inválidos o payload mal formado no consumen intento.
- Repetir la misma respuesta devuelve replayed=true y xp_awarded=0; no duplica XP.
- Cambiar la respuesta tras resolver devuelve 409. Generar refuerzo para otro intento.
- MEMORY_MATCH requiere todos los pares, sin repetir cartas; el orden de los pares no importa.
- ORDER_SEQUENCE requiere todos los IDs una sola vez y compara el orden exacto.
- FALLING_TILES compara el conjunto exacto de bloques correctos; el orden no importa.
- FILL_BLANK normaliza Unicode NFC, espacios y mayúsculas, conservando tildes y
  símbolos matemáticos. No emplea coincidencia difusa.

Progress contiene answered, correct, total, xp (de esta misión), completed,
can_advance y next_activity_id (null al completar). Usar progress.xp como valor
absoluto en React, evitando sumar otra vez XP por un reintento de red.

### XP, adaptación y perfil

XP base por modalidad en el orden de la tabla: 10/12/16/14/12. Multiplicador de
dificultad beginner/intermediate/advanced: 1/2/3. Incorrecta: 0. El cliente no decide XP.

Adaptation contiene action (continue/review/reinforce/increase_difficulty/advance),
next_difficulty, review_objective_index (nullable) y reason. Un error recomienda
repaso; dos consecutivos recomiendan refuerzo y bajar un escalón; tres aciertos
consecutivos recomiendan subir un escalón. Se aplica al generar la siguiente misión,
sin cambiar actividades ya generadas. Las preferencias de juego no elevan dificultad.

can_advance exige misión completa, al menos tres entregas del historial, >=80% de
aciertos y un acierto por objetivo. El historial guarda hasta 100 entregas y se hereda
solo mediante previous_mission_id. Cada misión admite una sola continuación; debe
tener el mismo curso, unidad, nivel, objetivos y fuente. No se guarda todo el mapa.

StudentProfile: study_area, academic_level, learning_goal (textos obligatorios),
available_minutes (1–240), preferred_modalities (1–5 sin repetidos, defecto todas),
motivation_tone (friendly/competitive/humorous, defecto friendly), initial_knowledge
(beginner/intermediate/advanced, defecto beginner). El perfil no diagnostica personalidad.
El autoinforme inicial solo orienta la primera misión; las continuaciones usan el
desempeño del servidor, ignorando un nuevo initial_knowledge enviado por el cliente.

### Next.js: generación y entrega

```typescript
const API = "http://localhost:8000";
async function api(path: string, body?: unknown) {
  const response = await fetch(`${API}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const json = await response.json();
  if (!response.ok) throw json.error;
  return json;
}
const mission = await api("/api/missions/generate", request);
sessionStorage.setItem("trikupMissionId", mission.mission_id);
// Renderizar progress.next_activity_id y discriminar componentes por modality.
const result = await api("/api/missions/answer", {
  mission_id: mission.mission_id,
  activity_id: selectedActivity.id,
  answer: studentAnswer,
});
// Mostrar feedback/explanation, asignar XP = result.progress.xp.
// Al completar, generar refuerzo con el mismo contexto y previous_mission_id.
```

Jeremy implementa entradas, selección de opciones, cartas volteables, ordenación y
animación de bloques. La estructura y corrección no requieren interpretar texto de IA.
Deshabilitar envíos en curso, conservar el mismo payload al reintentar una red y
contemplar 410 por expiración. No incluir claves Gemini en el frontend.

### Límites, almacenamiento y errores de misiones

JSON máximo 128 KiB; carga máxima 30 segundos; dos generaciones simultáneas por proceso.
TTL fijo de 30 minutos, hasta 128 misiones y 8 MiB de presupuesto de JSON serializado
(Python tiene overhead adicional). Limpieza perezosa, sin renovar TTL al responder.
La fuente no queda en el almacén: solo su hash de contexto y las actividades/soluciones.
Máximo 64 KiB de borrador generado. No hay reintentos automáticos de Gemini.

Sin autenticación, los IDs son capacidades temporales: quien obtenga un mission_id
puede leer/resolver esa misión. No hay identidad verificada, notas oficiales o XP global
confiable. Reiniciar pierde el estado; varios workers no comparten memoria. Usar un
solo worker para este MVP. Los IDs expirados recientes dan 410; después pueden dar 404.

| HTTP | error.code | Cuándo |
|---|---|---|
| 422 | VALIDATION_ERROR / INVALID_ANSWER | Contrato inválido, extra fields, modalidad o IDs inválidos |
| 422 | INSUFFICIENT_CONTEXT | Fuente sin teoría suficiente para actividades sustentadas |
| 404 | MISSION_NOT_FOUND / ACTIVITY_NOT_FOUND | Misión o actividad desconocida |
| 410 | MISSION_EXPIRED | Misión expirada |
| 409 | ACTIVITY_OUT_OF_ORDER / ACTIVITY_ALREADY_ANSWERED | Fuera de orden o cambio tras evaluación |
| 409 | INVALID_CONTINUATION / CONTINUATION_UNAVAILABLE | Continuación inválida o ya consumida/reservada |
| 429 | MISSION_BUSY | Dos generaciones en curso |
| 503 | MISSION_CAPACITY | Almacén temporal lleno; no se expulsa una sesión activa |
| 502 | INVALID_MISSION / UNSUPPORTED_CONTENT | Respuesta inválida, ambigua o sin evidencia |

Los errores seguros del proveedor conservan el formato común y estados 429/502/503/504.
Detalles de diseño y limitaciones: [guía del motor](missions-engine.md).

## POST /api/roadmaps/generate

Solicitud `RoadmapRequest`:

| Campo | Tipo | Restricción / valor por defecto |
|---|---|---|
| career | string | Obligatorio, texto |
| semester | integer | Obligatorio, 1–20 |
| skills | string[] | Máximo 50 textos; defecto `[]` |
| goals | string[] | Obligatorio, 1–20 textos |
| weekly_hours | integer | 1–40; defecto 5 |

```json
{"career":"Ingeniería de Sistemas","semester":5,"skills":["Python"],"goals":["Desarrollar APIs"],"weekly_hours":5}
```

200 futuro, esquema `RoadmapResponse`:

```json
{
  "title":"Ruta backend","summary":"Construir una API REST con Python.",
  "stages":[{
    "order":1,"title":"Fundamentos HTTP","duration_weeks":2,
    "skills":["HTTP","FastAPI"],"activities":["Crear un endpoint de salud"],
    "deliverable":"API local documentada"
  }]
}
```

`title`, `summary`: texto; `stages`: array no vacío de `RoadmapStage`.
Cada etapa: `order` y `duration_weeks` integer ≥ 1; `title`, `deliverable` texto;
`skills` y `activities` arrays no vacíos de textos. El orden previsto es ascendente
y consecutivo desde 1; las etapas se realizan secuencialmente.

## POST /api/planner/generate

Solicitud `PlannerRequest`:

| Campo | Tipo | Restricción / valor por defecto |
|---|---|---|
| week_start | string date | Obligatorio, lunes de la semana |
| timezone | string enum | Solo `America/Lima`; mismo valor por defecto |
| availability | TimeWindow[] | Obligatorio, 1–50 ventanas sin superposición |
| courses | Course[] | Obligatorio, 1–20 cursos con IDs únicos |

`TimeWindow`: `day` enum `monday`, `tuesday`, `wednesday`, `thursday`, `friday`,
`saturday`, `sunday`; `start`, `end` horas locales. `end > start`, mismo día;
no se admiten ventanas nocturnas que crucen medianoche. Ventanas adyacentes sí.

`Course`: `id`, `name` texto obligatorio; `priority` enum `low`, `medium`, `high`
(defecto `medium`); `weekly_hours` integer obligatorio 1–40.

```json
{
  "week_start":"2026-11-09","timezone":"America/Lima",
  "availability":[{"day":"monday","start":"18:00","end":"20:00"}],
  "courses":[{"id":"calc-1","name":"Cálculo I","priority":"high","weekly_hours":2}]
}
```

200 futuro, esquema `PlannerResponse`:

```json
{
  "week_start":"2026-11-09","timezone":"America/Lima",
  "sessions":[{
    "day":"monday","start":"18:00:00","end":"20:00:00",
    "course_id":"calc-1","objective":"Practicar límites"
  }],
  "warnings":[]
}
```

`week_start` fecha, `timezone` mismo enum; `sessions` array de `StudySession`
(puede estar vacío), cada uno tiene los campos de `TimeWindow` más `course_id`
y `objective` texto. `warnings` array de textos, defecto `[]`.
Comportamiento futuro: sesiones dentro de la disponibilidad, sin superposición,
solo referencias a cursos de entrada. Si faltan horas, se devuelve un plan parcial
y advertencias de lo pendiente; no se amplía la disponibilidad automáticamente.
Estas reglas de generación no están implementadas en fase 1.

## Errores comunes

Todos los errores de la aplicación tienen esquema `ErrorResponse`:

```json
{
  "error":{
    "code":"NOT_IMPLEMENTED",
    "message":"Funcionalidad pendiente de implementación en la siguiente fase.",
    "details":[]
  }
}
```

| HTTP | code | Cuándo |
|---|---|---|
| 422 | VALIDATION_ERROR | JSON inválido, campos ausentes/no permitidos o restricciones incumplidas |
| 404 | NOT_FOUND | Ruta inexistente |
| 405 | METHOD_NOT_ALLOWED | Método no admitido para la ruta |
| 501 | NOT_IMPLEMENTED | Roadmaps y planificador pendientes |
| 500 | INTERNAL_ERROR | Error inesperado; no expone detalles internos |
| 408 | HTTP_ERROR | Carga de PDF superior a 30 segundos |
| 413 | HTTP_ERROR | Exceso del límite de cuerpo, archivo, páginas o texto |
| 415 | HTTP_ERROR | MIME del archivo distinto de application/pdf |
| 429 | HTTP_ERROR | Concurrencia local o cuota/límite de Gemini agotados |
| 502 | HTTP_ERROR | Fallo del proveedor, conexión, JSON inválido o contenido sin evidencia |
| 503 | HTTP_ERROR | Configuración, credenciales, acceso/modelo o esquema no admitido |
| 504 | HTTP_ERROR | Tiempo de espera de Gemini agotado |

`error.code`, `error.message`: strings. `error.details`: array de objetos
con `field` (ruta con puntos, string) y `message` (string). Siempre se incluye,
aunque esté vacío. El frontend debe decidir por `code`, no por el texto del mensaje.

Ejemplo 422 para `weekly_hours: 0` en un roadmap:

```json
{
  "error":{
    "code":"VALIDATION_ERROR","message":"La solicitud no cumple el contrato.",
    "details":[{"field":"body.weekly_hours","message":"Input should be greater than or equal to 1"}]
  }
}
```

Errores propios de proxies, servidor HTTP o preflight CORS pueden tener otro formato.
Un PDF inválido, protegido, sin texto o sin información académica suficiente devuelve
422 `VALIDATION_ERROR`. Los errores del proveedor no exponen mensajes brutos ni claves.

## Integración independiente

El frontend puede usar los ejemplos 200 como mocks y OpenAPI para generar tipos.
Contra el backend actual puede consumir directamente el análisis de sílabos como JSON,
mostrar el estado pendiente al recibir 501 y errores de formulario al recibir 422.
Debe contemplar los errores operativos anteriores, sin depender del texto del mensaje.
