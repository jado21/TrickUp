# Motor de misiones — Prompt 3

Implementado y verificado localmente con mocks. **No se realizó una generación real
de misiones ni se consumieron tokens de Gemini en este Prompt 3.** La Fase 2 y su
servicio de sílabos se reutilizan; no se modificaron las instrucciones de sílabos,
credenciales, SDK ni el adaptador de JSON Schema.

## Flujo para Jeremy

1. Analizar el sílabo con el endpoint existente y seleccionar unidad/nivel.
2. Solicitar material académico adicional en un textarea: apuntes, lectura o teoría.
   El mapa solo trae títulos/objetivos y no permite deducir respuestas sustentadas.
   En este MVP no hay otro endpoint de extracción de materiales. No inventar teoría
   ni enviar la clave Gemini desde Next.js.
3. Enviar curso, unidad, datos del nivel, objetivos y source_text a
   `POST /api/missions/generate`. Es opcional enviar StudentProfile.
4. Conservar mission_id temporalmente y renderizar la actividad indicada por
   progress.next_activity_id, discriminando por modality.
5. Enviar `POST /api/missions/answer` con el ID de misión, actividad y respuesta.
   Solo después se muestran explicación y solución. Actualizar XP usando el total
   absoluto progress.xp. No calcular notas autoritativas en el navegador.
6. Al terminar, usar can_advance para habilitar el avance visual. Para refuerzo o
   continuación del mismo nivel, volver a generar con previous_mission_id y el mismo
   contexto. El backend decide la dificultad desde su historial, no desde preferencias.
7. Recuperar actividades y progreso con `GET /api/missions/{mission_id}`. Mostrar
   expiración ante 410 y pedir una nueva misión; no reintentar automáticamente generación.

El backend entrega datos; Jeremy implementa animaciones de bloques, volteo y selección
de cartas, controles de ordenación y formularios. No necesita interpretar prosa de
Gemini para conocer estructuras. Es conveniente deshabilitar enviar mientras la
petición está en curso y conservar el payload ante un reintento de red.

## Contrato y ejemplos

El [contrato principal](api-contract.md#misiones--prompt-3) incluye parámetros,
restricciones, errores, evaluación y ejemplo TypeScript para Next.js.

Ejemplos sintéticos preparados con mocks, sin llamadas reales:

- [Solicitud con contexto y perfil](examples/missions-generate-request.json).
- [Respuesta con las cinco modalidades públicas](examples/missions-response.json).
- [Cinco entregas y sus respuestas completas de feedback](examples/missions-answer-examples.json).

Los IDs y fechas de estos archivos son ilustrativos; no corresponden a sesiones
activas. No copiar soluciones de los ejemplos como lógica del frontend.

| Modalidad | Datos públicos | Evaluación determinista |
|---|---|---|
| MULTIPLE_CHOICE | Cuatro opciones con IDs aleatorios | ID elegido igual al almacenado |
| FILL_BLANK | Frase con un único ___ | Igualdad con respuesta/variantes admitidas, normalizando NFC, espacios y mayúsculas |
| MEMORY_MATCH | Dos conjuntos de cartas con IDs independientes | Conjunto completo de pares correcto; cada carta se usa una vez |
| ORDER_SEQUENCE | Pasos con IDs aleatorios y orden mezclado | Lista completa en el orden almacenado |
| FALLING_TILES | Bloques mezclados, sin flags de corrección | Conjunto exacto de bloques correctos; sin puntuación parcial |

## Arquitectura

```text
app/schemas/missions.py           contratos públicos y perfil
app/schemas/mission_internal.py   borrador del proveedor y soluciones privadas
app/services/missions.py         generación, evidencia y proyección pública
app/services/mission_engine.py   evaluación, XP y reglas de adaptación
app/services/mission_store.py    TTL, capacidad y mutación atómica
app/api/mission_limits.py        límite de cuerpo antes de parsear JSON
app/api/routes.py                rutas existentes y nuevas
```

Se reutiliza `GeminiService.generate_json` con instrucciones específicas de misiones
y MissionDraft. La generación usa JSON estructurado, el modelo configurado, un solo
intento y los mismos límites de tiempo del servicio ya existente. No hay otro SDK,
cliente alternativo, proveedor o reintento por modalidad.

El formato privado que recibe Gemini es deliberadamente sencillo: modalidad enum,
datos específicos o null y citas de fuente. La proyección pública usa una unión
discriminada para que Next.js conozca exactamente los campos de cada modalidad.

Las evidencias deben aparecer en source_text; respuestas correctas, conceptos,
definiciones y pasos deben estar en sus citas. Las explicaciones son extractos del
material y el orden de pasos debe corresponder a su orden explícito. Distractores y
enunciados se generan bajo instrucciones de no añadir conocimiento externo como
verdadero. Estas comprobaciones verifican procedencia textual, no garantizan por sí
solas una asociación semántica o calidad pedagógica perfecta. Por eso la generación
real de misiones queda pendiente de una revisión autorizada.

## XP y adaptación

Base de XP: elección 10, completar 12, memoria 16, orden 14, bloques 12. Multiplicador
beginner/intermediate/advanced: 1/2/3. Incorrecta: 0. Todos los valores salen de código
del servidor; Gemini no define XP y el request no acepta puntuaciones.

Se guarda hasta un máximo de 100 resultados del mismo contexto académico:

- Un error: recomendar repaso del objetivo.
- Dos errores consecutivos: refuerzo y reducir una dificultad, hasta beginner.
- Tres aciertos consecutivos: subir una dificultad en la siguiente misión, hasta advanced.
- Dominio: misión terminada, al menos tres entregas, >=80% de aciertos y un acierto
  por cada objetivo. Se permite entonces avance visual del nivel.

El perfil inicial es autoinforme y no una evaluación oficial. Solo orienta la primera
dificultad, contexto, modalidades y tono. Las continuaciones ignoran un nuevo nivel
inicial declarado y usan el historial del servidor. Los tonos y preferencias estéticas
no determinan dominio ni elevan dificultad por sí solos. No hay perfiles psicológicos.

Cada misión admite una continuación. Su origen debe estar completo y coincidir en
curso/unidad/nivel/objetivos/fuente. Se reserva durante la llamada a Gemini y se libera
si falla. No se admite bifurcar indefinidamente un mismo historial mediante ese ID.

## Seguridad del estado temporal

Las soluciones nunca se devuelven en generación ni en GET. Se conservan solo en
MissionEntry, separado de la respuesta pública. El servidor genera IDs aleatorios
para misiones, actividades y elementos; no codifican la respuesta ni la pareja.
Los dos lados de memoria se mezclan independientemente.

Una actividad admite un intento evaluable. Datos mal formados, IDs inválidos o
entregas fuera de orden no consumen intento. Una respuesta repetida equivalente
devuelve replayed=true y xp_awarded=0; otra respuesta después de evaluarla produce
409. Evaluación y actualización de estado son atómicas con un lock, por lo que dos
entregas simultáneas no duplican XP. El control de memoria también es atómico: un
fallo de capacidad no confirma parcialmente puntuación o progreso.

Límites por proceso:

- 128 misiones, TTL fijo de 1800 segundos desde su creación.
- 8 MiB de presupuesto de JSON serializado, no de RSS exacto de Python. Objetos y
  estructuras tienen overhead adicional, pero su número/tamaño están acotados.
- Hasta diez actividades por misión; 64 KiB de borrador generado.
- Cuerpo de request de hasta 128 KiB; carga de hasta 30 segundos.
- Dos generaciones de misiones simultáneas; sin cola ni reintentos automáticos.
- Limpieza perezosa al acceder. Hasta 256 IDs expirados recientes para informar 410;
  un ID más antiguo puede dar 404. No se renueva TTL al responder.

El almacén no conserva source_text ni el perfil completo, solo el hash de contexto,
tono, actividades, soluciones y resultados necesarios. No se persisten PDFs.

**No es producción distribuida.** Sin autenticación, conocer el ID permite acceder
a esa misión. No hay identidad del estudiante, calificaciones oficiales, XP global,
protección contra crear nuevas sesiones ni historial persistente de todo el mapa.
No hay rate limiting persistente. Un reinicio o --reload pierde sesiones. Usar un
único worker; para múltiples instancias habría que añadir almacenamiento compartido
y autenticación antes de confiar en premios o progresión global.

## Verificación y estado

La suite usa mocks y un caso con el SDK real sobre httpx.MockTransport. No consume
tokens ni lee claves para efectuar llamadas externas. Incluye cinco modalidades,
respuestas correctas/incorrectas, IDs, replay, evaluación concurrente, capacidad,
expiración, continuidad, recomendaciones, cobertura de objetivos y contratos previos.

```powershell
cd backend
.venv/Scripts/python.exe -m pytest -q --tb=short
.venv/Scripts/python.exe -m pip check
.venv/Scripts/python.exe -m compileall -q app scripts tests
```

El motor está preparado para una prueba real controlada, pero **no se afirma que
una generación real de misiones haya pasado**. Requiere autorización adicional.
La [verificación HTTP preparada](missions-http-verification.md) documenta la única
generación propuesta, el material de prueba y los controles ya validados con mocks.
Una prueba futura debería usar el material sintético de los ejemplos, verificar la
calidad semántica de las cinco modalidades y evaluar sus respuestas en el servidor.
No se implementaron roadmaps, planificador ni funcionalidades fuera del Prompt 3.

Verificación ejecutada al entregar este Prompt 3: **148 pruebas aprobadas**, cero
fallidas, dos advertencias de deprecación de dependencias. `pip check` no encontró
incompatibilidades; `compileall` terminó sin errores. Las nuevas pruebas incluyen
la mezcla independiente de dos cartas por lado y validación de los ejemplos JSON.
