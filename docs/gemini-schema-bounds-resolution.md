# Resolución del HTTP 400 académico — 2026-11-07

**Fase 2 lista para cerrarse para el alcance del MVP.** La única llamada real de
esta revisión devolvió HTTP 200 desde `POST /api/syllabus/analyze`, con un mapa
académico que pasó los modelos originales de Pydantic y las comprobaciones de
contenido. No se inició el Prompt 3.

## Cambio controlado

Se retiraron **6 restricciones**, únicamente del esquema que se envía al proveedor:

| Array | minItems eliminado | maxItems eliminado |
|---|---|---|
| DraftSyllabus.units | 1 | 20 |
| DraftUnit.levels | 1 | 20 |
| DraftLevel.objectives | 1 | 10 |

La cadena anidada es unidades → niveles → objetivos. Se mantienen las referencias,
tipos, objetos, propiedades requeridas, nulabilidad, additionalProperties y todos
los demás elementos del esquema anterior. La omisión anterior de minLength y
maxLength se conserva; no forma parte de las seis restricciones nuevas eliminadas.

El cambio está en `app/services/gemini_schema.py`. `omit_array_bounds=False`
permite reconstruir la variante anterior para comparaciones locales, sin cambiar
los modelos. La configuración normal del endpoint usa la variante simplificada.

**No se modificaron** los modelos Pydantic, `docs/api-contract.md`, el PDF sintético,
las instrucciones académicas de `gemini.py`, el SDK 1.75.0, requirements.txt,
el modelo, el proveedor, `.env` o el frontend. Las huellas SHA-256 de modelos,
contrato, fuente del PDF y servicio/instrucciones coincidieron antes y después.

## Pruebas locales

MockTransport capturó las dos solicitudes reales serializadas por el SDK, con
credenciales ficticias y sin red. Se verificó que el cuerpo completo solo cambia
en las seis ubicaciones mencionadas. Permanecen iguales ruta, instrucciones,
texto de entrada, responseMimeType, maxOutputTokens y el resto del esquema.

Se añadieron seis casos para confirmar que Pydantic sigue rechazando:

- Cero unidades o más de 20.
- Cero niveles o más de 20 por unidad.
- Cero objetivos o más de 10 por nivel.

Comandos desde `backend/`:

```powershell
.venv/Scripts/python.exe -m pytest -q --tb=short
.venv/Scripts/python.exe -m pip check
.venv/Scripts/python.exe -m compileall -q app scripts tests
```

Resultado antes y después de la llamada real: **103 aprobadas, cero fallidas**.
Dos advertencias de deprecación en dependencias. `pip check` no encontró
incompatibilidades y no hubo errores de compilación. Pytest no consume Gemini.

## Única llamada real

Se ejecutó el script de auditoría existente sobre un Uvicorn temporal. Primero
comprobó salud, documentación, CORS y PDFs inválidos sin llamar al SDK. Después
envió un único PDF sintético válido a `/api/syllabus/analyze`.

| Comprobación | Resultado |
|---|---|
| Llamadas reales al SDK | Exactamente 1 |
| Reintentos | Ninguno; attempts=1 |
| Endpoint | HTTP 200 |
| Generación estructurada | Activa |
| Modelo | gemini-3.5-flash-lite, sin cambios |
| Texto extraído enviado | Sí, 340 caracteres |
| Pydantic original | Validación exitosa |
| Campos públicos | Coinciden con SyllabusResponse y api-contract.md |
| Secretos en respuesta | Ninguno |
| CORS localhost:3000 | Correcto |
| Servidor temporal | Detenido al finalizar |

Respuesta real completa, guardada sin credenciales:
[examples/syllabus-real-response.json](examples/syllabus-real-response.json).

## Validación académica

- Curso: **Cálculo I**.
- Descripción: fundamentos de límites y continuidad de funciones reales.
- Una unidad: **Unidad 1: Límites y continuidad**.
- Primer nivel: **Tema 1: Concepto de límite**; objetivo de interpretar límites
  de funciones a partir de gráficas.
- Segundo nivel: **Tema 2: Continuidad de funciones**; objetivo de identificar
  continuidad en un punto.
- Orden igual al documento: concepto de límite antes de continuidad.
- IDs únicos generados por el backend.
- Todos los títulos, descripción y objetivos aparecen en el texto extraído.
  El servicio también validó las citas privadas antes de producir la respuesta.

No se añadieron temas externos en esta respuesta. El JSON ya está en el formato
REST público; el frontend puede consumirlo con `response.json()`.

## Interpretación del diagnóstico

Con el mismo modelo, SDK, texto, instrucciones y configuración de generación, la
solicitud previa con los límites anidados fallaba y la variante sin esos seis
límites fue aceptada. La comparación local confirmó que ese es el único cambio
del cuerpo. Esto respalda que la configuración de restricciones de arrays del
esquema anterior provocaba el rechazo en este caso y justifica conservar la
simplificación para el proveedor.

El experimento no separa el efecto individual de minItems y maxItems ni demuestra
un defecto universal de esas keywords: se retiraron juntas, como se autorizó.
Los límites de dominio continúan siendo obligatorios mediante Pydantic local.
La respuesta real aprobada corresponde al PDF sintético probado; no supone que
todos los sílabos posibles tendrán la misma estructura o calidad de clasificación.

La hipótesis coincide con el [reporte reproducible vercel/ai #21192](https://github.com/vercel/ai/issues/21192),
que describe rechazos de esquemas con varias restricciones maxItems y la validación
local como protección al simplificar el esquema del proveedor. El resultado de
TriKUp se verificó por separado, no se infirió únicamente de ese reporte.

## Archivos de esta revisión

- `backend/app/services/gemini_schema.py`.
- `backend/tests/test_gemini_compatibility.py`.
- `backend/tests/test_syllabus.py`.
- `docs/syllabus-analysis.md`.
- `docs/gemini-compatibility.md`, `docs/gemini-progressive-diagnosis.md` y
  `docs/qa-phase2-audit.md`: avisos que enlazan la resolución posterior.
- `docs/examples/syllabus-real-response.json`.
- Este informe.

Las capturas originales/simplificadas, huellas de archivos y auditoría sanitizada
se conservan bajo `backend/.tmp/`, ignorado por Git. No repetir la llamada bajo la
autorización de esta revisión: el presupuesto de una llamada ya se utilizó.
