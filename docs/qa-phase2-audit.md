# Auditoría técnica y funcional de Fase 2 — 2026-11-07

> **Resultado actualizado:** la [resolución posterior](gemini-schema-bounds-resolution.md)
> obtuvo HTTP 200 real, validación académica y 103 pruebas aprobadas. La Fase 2
> queda lista para cerrarse en el alcance del MVP. El informe inferior es histórico.

**Dictamen: NO está lista para cerrar la Fase 2 ni avanzar al Prompt 3.**
Las pruebas locales pasan, pero la única generación real de esta auditoría fue
rechazada por Gemini. No se obtuvo un mapa académico real validable.

## Alcance y consumo

- Revisión de `backend/app`, schemas, servicios, middleware, configuración,
  dependencias, pruebas y contrato de integración.
- Sin cambios en frontend, `.env`, autenticación, base de datos o misiones.
- Exactamente **una llamada al SDK de generación real** en esta auditoría.
  Los POST de PDFs inválidos se rechazaron antes de llegar al SDK.
- No se imprimieron los valores de GEMINI_API_KEY ni GEMINI_MODEL.
- Servidor Uvicorn temporal detenido al finalizar.

## Resultado por componente

| Componente | Estado | Prueba realizada | Resultado obtenido | Corrección aplicada |
|---|---|---|---|---|
| Arquitectura/imports/sintaxis | APROBADO | Inspección, imports durante pytest y compileall | Organización api/services/schemas; sin errores de sintaxis | Ninguna |
| Dependencias | APROBADO | requirements.txt y pip check | Dependencias necesarias instaladas; sin incompatibilidades declaradas | Ninguna |
| Uvicorn y salud | APROBADO | Arranque real y GET /api/health | HTTP 200 | Ninguna |
| Registro del sílabo | APROBADO | OpenAPI y envío multipart real | POST registrado y recibido | Ninguna |
| Documentación HTTP | APROBADO | GET /docs, /openapi.json y rutas /api equivalentes | Originalmente 404 en rutas cortas; ahora 307 → 200 | Alias de redirección, sin rutas nuevas en OpenAPI |
| Configuración | APROBADO | Comparación interna .env ↔ load_settings | Clave y modelo presentes y cargados, sin revelar valores | Ninguna |
| Extracción PDF | APROBADO | PyMuPDF sobre PDF sintético | 340 caracteres extraídos; texto incluido en la solicitud al SDK | Ninguna |
| Validación PDF | APROBADO | Peticiones HTTP con archivo inválido, vacío, PDF blanco, escaneado, MIME incorrecto y exceso de tamaño | 422, 422, 422, 422, 415 y 413; cero llamadas al SDK | Ninguna |
| Límites adicionales | APROBADO | Pruebas locales de páginas, texto, cuerpo chunked y concurrencia | Rechazo según límites establecidos | Ninguna |
| Conexión/generación real | FALLIDO | Una llamada con SDK oficial, modelo configurado, texto extraído y esquema JSON | Proveedor HTTP 400; endpoint HTTP 502 | No se cambió el payload por conjetura ni se reintentó |
| JSON/Pydantic | APROBADO | Mocks de éxito, validación del error real y ejemplos documentados | Error real y mocks válidos; campos públicos preservados | Actualización del estado operativo del contrato |
| Mapa académico real/progresión | NO VERIFICADO | Dependía de respuesta real exitosa | No hubo curso/unidades/niveles que evaluar | Pendiente resolver HTTP 400 |
| Sustento del mapa real | NO VERIFICADO | Dependía de respuesta real exitosa | Las citas inventadas se rechazan en mocks; falta verificar un resultado real | Pendiente resolver HTTP 400 |
| Consumo por Next.js | NO VERIFICADO | Revisión del contrato y respuestas simuladas; sin ejecutar frontend | FormData y response.json() son suficientes estructuralmente; flujo de éxito real pendiente | Sin cambios en frontend |
| Cuota/timeout/respuestas inválidas | APROBADO | Mocks de APIError, errores de red y salida inválida | 429/503/504/502 y un intento por análisis | Ninguna |
| Secretos y Git | APROBADO | Clave ausente de respuesta real; git check-ignore y git ls-files | .env ignorado y no versionado; valores no publicados | Ninguna en .env |
| Logs ante fallo inesperado del SDK | APROBADO | Regresión con clave ficticia en RuntimeError, capturando logs y salida | Inicialmente falló; tras corrección no filtra el mensaje | Convertir excepciones inesperadas del SDK en ServiceError seguro; logger general sin mensaje/traceback original |
| CORS | APROBADO | Preflight real y respuesta real de error con Origin localhost:3000 | Origen permitido y cabeceras CORS presentes | Ninguna |
| Suite final | APROBADO | pytest completo, sin red a Gemini | 82 aprobadas, 0 fallidas, 2 advertencias | Tres pruebas de documentación/SDK y una regresión de logs añadidas |

Las verificaciones semánticas no se consideran aprobadas solo por pasar Pydantic.
La procedencia textual no prueba por sí sola la correcta asociación de objetivos o
el orden pedagógico. Estas comprobaciones siguen pendientes para la respuesta real.

## Error exacto observado

Proveedor Gemini: **HTTP 400**.

```text
Request contains an invalid argument.
```

Respuesta pública real del endpoint: **HTTP 502**.

```json
{
  "error": {
    "code": "HTTP_ERROR",
    "message": "Gemini no pudo procesar la solicitud.",
    "details": []
  }
}
```

La instrumentación confirmó texto extraído enviado, uso del modelo configurado,
generación estructurada activa y `attempts=1`. El identificador del modelo tiene
formato válido; la clave no contiene espacios exteriores ni saltos de línea. No
se detectaron variables que seleccionen otro backend o una URL Gemini alternativa.

El mensaje disponible no identifica el argumento inválido. **No se ha determinado
la causa exacta**, ni se atribuye el fallo a una clave incorrecta o a un modelo
inexistente sin evidencia. Tampoco se afirma que el mapa se haya generado.

## Pruebas ejecutadas y correcciones

```powershell
# Desde backend/
.venv/Scripts/python.exe -m pytest -q --tb=short
.venv/Scripts/python.exe -m pip check
.venv/Scripts/python.exe -m compileall -q app scripts tests
```

Suite inicial: 78 aprobadas. Suite final: **82 aprobadas**, 2 advertencias de
deprecación en Starlette/httpx y Google GenAI/Python 3.14. La nueva regresión de
logs falló antes de corregir el manejo de excepciones y pasó después.

Los casos de PDF usan PyMuPDF real. Las llamadas de generación en pytest usan mocks;
una prueba adicional usa el SDK instalado con `httpx.MockTransport`, sin red ni
tokens, y verifica la serialización del cuerpo. Esa prueba no demuestra que Google
acepte el payload: solo que el SDK lo serializa según lo esperado localmente.

El contrato se actualizó únicamente para reflejar Fase 2, errores operativos y alias
de documentación. No cambiaron campos ni tipos de entrada/salida públicos. Los
temas se representan como títulos de nivel y la progresión como orden de arrays.

Archivos modificados o creados en esta auditoría:

- `backend/app/main.py`: redirecciones y logging seguro.
- `backend/app/services/gemini.py`: sanitización de fallos inesperados.
- `backend/tests/test_audit_regressions.py`: pruebas de documentación.
- `backend/tests/test_syllabus.py`: SDK con transporte simulado y regresión de logs.
- `backend/scripts/audit_phase2.py`: auditoría opt-in con límite de una generación.
- `docs/api-contract.md`, `docs/syllabus-analysis.md` y este informe.

## Qué falta y cómo completarlo

1. Identificar el argumento rechazado por Google. El script ya quedó preparado para
   capturar `status`, razones y `fieldViolations` del proveedor de forma sanitizada
   en una futura prueba autorizada. No se hizo otra llamada para obtenerlos.
2. Corregir únicamente el parámetro/configuración señalado por ese diagnóstico.
   No cambiar de modelo ni desactivar esquemas automáticamente por conjetura.
3. Con autorización para otra única solicitud, repetir el PDF sintético y exigir
   HTTP 200, validación estricta de `SyllabusResponse`, campos exactos del contrato,
   curso correcto, una unidad con dos temas en su orden y textos sustentados.

El script es opt-in y consume una generación real al ejecutarse con `--live`:

```powershell
.venv/Scripts/python.exe scripts/audit_phase2.py --live
```

El resultado sanitizado de la ejecución de esta auditoría está en
`backend/.tmp/qa-audit-result.json`, ignorado por Git. No ejecutar de nuevo sin
autorizar expresamente otro consumo. No se avanzó al Prompt 3.
