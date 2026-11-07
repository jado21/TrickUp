# Compatibilidad Gemini 3.5 Flash-Lite — 2026-11-07

> **Actualización posterior: HTTP 400 resuelto para la solicitud probada.**
> [Simplificación de límites de arrays y HTTP 200 real](gemini-schema-bounds-resolution.md).
> Se conservan Pydantic y el contrato; 103 pruebas locales aprobadas.

> Diagnóstico posterior: [comparación SDK 1.75/2.34 y pruebas A → B → C](gemini-progressive-diagnosis.md).
> Las 96 pruebas locales pasan con ambos SDK. A y B reales funcionan; C sigue
> devolviendo HTTP 400. El contenido siguiente registra la revisión anterior.

## Resultado

El modelo indicado es oficial y admite salida estructurada. Se conservaron el
modelo solicitado y la generación JSON estructurada. La clave no se publicó.

La implementación instalada usa **google-genai 1.75.0** y **Pydantic 2.14.3**.
Tras el diagnóstico local y las correcciones, **89 pruebas locales pasaron**.
La única llamada real autorizada en esta revisión volvió a devolver **400
INVALID_ARGUMENT**. Por tanto, el problema **no está resuelto** y no se habilita
el avance al Prompt 3. No se efectuaron reintentos ni otras llamadas de generación.

## Comparación de parámetros

| Elemento | Comprobación local/documental | Decisión |
|---|---|---|
| Modelo | El `.env` en disco inicialmente no coincidía con el modelo indicado | Se actualizó solo GEMINI_MODEL a `gemini-3.5-flash-lite` tras autorización explícita |
| response_schema | El SDK lo admite, pero es una ruta de esquema distinta de JSON Schema | No se envía y no se mezcla con response_json_schema |
| response_json_schema | Admitido por el SDK instalado y serializado como responseJsonSchema | Se conserva el esquema estructurado |
| response_mime_type | `application/json` es compatible con JSON Schema | Se conserva |
| temperature | Se enviaba 0; Google recomienda los valores predeterminados para Gemini 3.x | Se omite; no se afirma que 0 fuera por sí solo la causa del 400 |
| top_p / top_k | No estaban configurados | Siguen sin enviarse |
| thinking_config | El SDK conoce thinking_level y thinking_budget; nuestra petición no envía ninguno | Se conserva el comportamiento predeterminado del modelo; no se fuerza un presupuesto incompatible |
| max_output_tokens | 8192, inferior al límite de salida documentado del modelo | Sin cambios |
| http_options | Timeout y attempts son opciones locales del SDK, no campos remotos de generationConfig | Una petición, sin reintentos; verificado con MockTransport |
| response_format | Aparece en documentación moderna, pero no existe en GenerateContentConfig instalado | No se agrega un parámetro que este SDK no conoce |

La guía de migración de Google recomienda SDK **2.0.0 o superior**. Nuestro
`requirements.txt` restringe a la rama 1.x. Esto es una diferencia respecto de la
recomendación actual, pero no demuestra que sea la causa del 400: los campos
empleados existen en 1.75.0 y su serialización fue comprobada. No se hizo una
actualización mayor sin validación ni se aseguró que esa actualización resolvería
el fallo. La documentación moderna también distingue configuraciones nuevas de
formatos y campos heredados; no se mezclaron APIs ni formatos de configuración.

## Esquema Pydantic

El esquema de `SyllabusAnalysis` es un objeto raíz con cuatro definiciones, referencias
internas no cíclicas y una alternativa nullable para `syllabus`. Las referencias no
tienen propiedades hermanas incompatibles. Se preservan `$defs`, `$ref`, `anyOf`,
`additionalProperties`, `required`, `minItems` y `maxItems`, todos incluidos en el
subconjunto documentado para responseJsonSchema.

Se detectaron dos `minLength` y dos `maxLength` en la definición de SupportedText.
Estas restricciones no figuran en el subconjunto documentado. Ahora solo se omiten
del esquema enviado a Google, mediante `app/services/gemini_schema.py`. Los modelos
Pydantic originales siguen rechazando textos vacíos o mayores de 2000 caracteres,
y no se modificaron los campos del contrato público.

La petición capturada sin red contiene exactamente estos campos en generationConfig:

```text
maxOutputTokens = 8192
responseMimeType = application/json
responseJsonSchema = esquema adaptado (1525 bytes en la representación local)
```

No contiene temperature, topP, topK, thinkingConfig ni responseSchema.
Este control de serialización no constituye una validación remota del esquema.
El 400 posterior demuestra que estos ajustes no bastaron para resolver el problema.

## Error en la herramienta de diagnóstico corregido

En google-genai 1.75.0, `APIError` expone `details`, `status` y `message`.
No expone `response_json`. El script de auditoría intentaba leer ese atributo y
podía reemplazar el error original por AttributeError durante el diagnóstico.

Se corrigió la lectura a `exc.details` y se añadieron pruebas con errores sintéticos.
Solo se exportan código, estado, mensaje sanitizado, reason y fieldViolations. Se
excluyen metadatos de cuenta/proyecto y se redactan la clave y valores sensibles.
Esta corrección mejora el diagnóstico; no cambia la solicitud enviada a Google.

## Única llamada real autorizada

Se usó el PDF sintético existente, texto extraído con PyMuPDF, modelo configurado,
esquema estructurado adaptado y `attempts=1`. Uvicorn, salud, documentación,
validaciones negativas de PDF y CORS funcionaron. El servidor temporal quedó detenido.

Detalle sanitizado obtenido:

```json
{
  "http_status": 400,
  "message": "Request contains an invalid argument.",
  "status": "INVALID_ARGUMENT",
  "details": []
}
```

No se recuperaron reason ni fieldViolations que identifiquen el argumento rechazado.
El endpoint devolvió 502 con el formato ErrorResponse, sin credenciales. No hubo mapa
generado. El resultado sanitizado está en `backend/.tmp/qa-audit-result.json`, ignorado
por Git. No se hizo otra petición para explorar variantes.

## Verificación local ejecutada

```powershell
# Desde backend/
.venv/Scripts/python.exe -m pytest -q --tb=short
.venv/Scripts/python.exe -m pip check
.venv/Scripts/python.exe -m compileall -q app scripts tests
```

Resultado: 89 aprobadas, cero fallidas y dos advertencias de deprecación en
dependencias. Las pruebas adicionales verifican el esquema adaptado, conservación
de restricciones Pydantic, serialización real del SDK con MockTransport y extracción
sanitizada de errores. Ninguna consume tokens de Gemini.

## Pendiente

No hay evidencia para atribuir el rechazo a una clave incorrecta, falta de soporte
de JSON, thinking_config o un campo específico. Una comparación adicional de versiones
del SDK puede hacerse localmente con transporte simulado; para confirmar aceptación
remota o aislar variantes de petición haría falta un nuevo presupuesto expresamente
autorizado. No se ejecutó esa comparación ni otra llamada real en esta revisión.

## Fuentes oficiales consultadas

- [Modelo Gemini 3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite).
- [Guía y recomendaciones de Gemini 3.5](https://ai.google.dev/gemini-api/docs/whats-new-gemini-3.5).
- [Referencia GenerateContent](https://ai.google.dev/api/generate-content).
- [SDK Python y referencia de tipos](https://googleapis.github.io/python-genai/).

Las fuentes se contrastaron con el código y tipos del SDK instalado; no se trató
la documentación de una versión nueva como si fuera idéntica a 1.75.0.
