# Análisis de sílabos — fase 2

El endpoint operativo es `POST /api/syllabus/analyze`, multipart con un único campo
`file` de MIME `application/pdf`. Se conservan exactamente los campos públicos de
[api-contract.md](api-contract.md): `course_name`, `summary`, `units` y sus niveles
con `id`, `title`, `objectives`. No se agregan `description`, `topics` ni `order`:
la descripción se representa en `summary`, los temas en los títulos de los niveles
y la progresión en el orden de los arrays.

El contrato fue actualizado durante la auditoría para describir la fase 2 sin
modificar los campos públicos. Este documento amplía los detalles operativos.
Las otras tres rutas de generación siguen devolviendo 501.

## Configuración

Usa `backend/.env` (ignorado por Git) o variables del entorno. El entorno tiene prioridad:

```dotenv
GEMINI_API_KEY=
GEMINI_MODEL=
GEMINI_STRUCTURED_OUTPUT=true
```

Se usa exactamente `GEMINI_MODEL`; no hay nombre de modelo predeterminado.
La generación estructurada envía un esquema JSON privado con evidencia mediante
`google-genai`. Si un modelo no admite esquemas, configura explícitamente
`GEMINI_STRUCTURED_OUTPUT=false`; en ese modo se solicita JSON y se valida de igual
manera. No se cambia de modelo ni se hace una segunda llamada automáticamente.

## Límites y validación

- PDF: máximo 5 MiB; cuerpo multipart total: 5 MiB + 64 KiB.
- Máximo 40 páginas y 60000 caracteres extraídos. Se rechaza el exceso, sin truncar
  silenciosamente ni perder las últimas unidades.
- Dos solicitudes de análisis simultáneas por proceso, sin cola. Límite de carga:
  30 segundos. SDK: 45 segundos por petición; presupuesto de generación: 60 segundos.
- Una sola llamada a Gemini por análisis, sin reintentos automáticos. Máximo 8192
  tokens de salida. Una respuesta truncada se rechaza.
- El contenido binario, imágenes y metadatos no se envían al modelo. Se envía texto
  extraído con espacios/saltos vacíos reducidos. No se ejecuta OCR.
- PDFs dañados, vacíos, protegidos con contraseña o sin texto extraíble se rechazan
  antes de llamar a Gemini.
- No se guarda el PDF en almacenamiento permanente. El parser multipart puede usar
  archivos temporales del sistema; FastAPI los cierra al finalizar la petición.

La extracción PyMuPDF se ejecuta secuencialmente en el event loop para evitar uso
concurrente desde threads. Este MVP puede bloquear brevemente otras solicitudes
durante la extracción; para cargas de producción habría que aislarla en procesos.
No hay límites globales entre procesos ni rate limiting persistente.

## Contenido sustentado

El modelo recibe instrucciones de tratar el documento como datos, respetar su orden
y no añadir contenido externo. Internamente devuelve una cita para cada texto.
El backend comprueba que las citas estén en el texto extraído y que cada título,
descripción y objetivo sea un extracto de su cita, normalizando espacios y mayúsculas.
Luego genera IDs únicos y valida `SyllabusResponse`. Las citas privadas no se exponen.

El esquema enviado al proveedor omite minItems/maxItems para evitar el rechazo
observado con restricciones de arrays anidados. Pydantic conserva los límites
originales (unidades, niveles y objetivos), y rechaza respuestas fuera de ellos.
La [prueba controlada de resolución](gemini-schema-bounds-resolution.md) documenta
el HTTP 200 real obtenido con este ajuste y el mismo contrato público.

Esto comprueba procedencia textual, no garantiza que el modelo clasifique
semánticamente cada fragmento de forma perfecta. No se inventan objetivos faltantes:
si el documento no ofrece información explícita suficiente, se devuelve 422.

## Errores operativos

Se conserva el envoltorio `ErrorResponse` con `error.code`, `message`, `details`.
`VALIDATION_ERROR` representa entradas/documentos inválidos. Los errores HTTP del
servicio usan el código genérico `HTTP_ERROR` que ya maneja la aplicación, con un
mensaje seguro y el estado correspondiente. Nunca se devuelve el error bruto de Google.

| HTTP | Situación |
|---|---|
| 408 | Carga que supera 30 segundos |
| 413 | Exceso de tamaño del cuerpo, archivo, páginas o texto |
| 415 | MIME distinto de application/pdf |
| 422 | Archivo ausente, PDF inválido/protegido/sin texto o sílabo insuficiente |
| 429 | Concurrencia local agotada o cuota/límite de Google agotado |
| 502 | Conexión/proveedor fallido, JSON inválido, respuesta incompleta o sin evidencia |
| 503 | Falta de configuración, credenciales/permisos/modelo incorrectos o esquema rechazado |
| 504 | Timeout del proveedor |

No se exponen claves, contenido del documento ni mensajes técnicos del proveedor
en estas respuestas. Ante un fallo, no hay reintento automático.

## Verificación

Desde `backend/`:

```powershell
.venv/Scripts/python.exe -m pytest -q
```

Pytest bloquea la construcción real del cliente Gemini salvo mocks explícitos.
Incluye PDFs generados en memoria, escaneados, protegidos y dañados, errores del
proveedor, límites de carga, citas inventadas y validación del contrato.

Para una prueba **manual y con consumo real**, existe:

```powershell
.venv/Scripts/python.exe scripts/verify_syllabus_swagger.py
```

Requiere Edge o Chrome local. Inicia servidor y navegador temporales sin ventana,
abre Swagger, pulsa `Try it out`, carga un PDF sintético basado en
`tests/fixtures/syllabus-example.txt` y pulsa `Execute` una sola vez. Comprueba la
respuesta con Pydantic y guarda el resultado en `.tmp/syllabus-live-response.json`
(ignorado por Git). El PDF de ejemplo y el perfil del navegador son temporales.
No ejecutes este script repetidamente si quieres evitar consumos adicionales.

Si el entorno no permite automatizar el navegador, `--http` ejecuta **una** petición
multipart real contra Uvicorn sin navegador. Ese modo verifica la API, no la
interacción visual con Swagger. No se usa automáticamente como segundo intento.

También puedes iniciar Uvicorn, abrir `/api/docs` y usar el campo `file` del endpoint.
No se requiere frontend ni base de datos.

Referencias de implementación: [SDK oficial de Google](https://googleapis.github.io/python-genai/)
y [PyMuPDF Document](https://pymupdf.readthedocs.io/en/latest/document.html).
