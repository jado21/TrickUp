# Diagnóstico progresivo Gemini — 2026-11-07

> **Actualización posterior:** la solicitud académica ya devolvió HTTP 200 al
> simplificar solo los límites de arrays del esquema enviado. Véase la
> [resolución verificada](gemini-schema-bounds-resolution.md).
> Este documento conserva el diagnóstico anterior A → B → C.

**Resultado: A y B funcionan; C falla. La generación real de niveles académicos
todavía no funciona.** Se detuvo la secuencia en el primer fallo, sin reintentos,
con exactamente tres llamadas reales en esta revisión. No se avanzó al Prompt 3.

## Fase 1: comparación local, sin generaciones reales

Se conservó google-genai 1.75.0 en `backend/.venv`. Se descargó **2.34.0** en
`backend/.tmp/sdk2`, una carpeta aislada e ignorada por Git. No se sustituyeron las
dependencias del backend ni se modificó `requirements.txt`.

`scripts/probe_genai_sdk.py` capturó tres solicitudes por versión mediante
`httpx.MockTransport`, sin leer `.env` y usando credenciales ficticias. Resultado:

| Caso | Cuerpo JSON 1.75 / 2.34 | Ruta | Api-Revision |
|---|---|---|---|
| A: texto sin configuración opcional | Iguales; solo contents | Igual | Igual |
| B: esquema mínimo | Iguales; responseMimeType y responseJsonSchema | Igual | Igual |
| C: solicitud académica | Iguales; instrucciones, texto, maxOutputTokens y esquema | Igual | Igual |

Ambas versiones admiten los campos utilizados. No se mezclan response_schema y
response_json_schema. Ninguna envía temperature, topP, topK o thinkingConfig en
estas pruebas. El esquema completo conserva la adaptación ya implementada y su
validación Pydantic original.

La suite completa pasó con las dos versiones:

- SDK 1.75.0: **96 aprobadas**, dos advertencias de dependencias.
- SDK 2.34.0 aislado: **96 aprobadas**, una advertencia de dependencia.

La migración es viable localmente para las funciones utilizadas: habría que
actualizar el rango de google-genai en requirements.txt e instalar la versión
seleccionada, revisando sus dependencias. No se necesitan cambios en los endpoints
o contratos según estas pruebas. La nota oficial de 2.0 identifica cambios
incompatibles en Interactions, API que TriKUp no utiliza.

Google recomienda 2.x, pero **no se confirmó que actualizar sea necesario para
resolver este fallo**: los cuerpos y rutas de nuestras solicitudes son iguales.
Esto no prueba que el servidor trate idénticamente todas las cabeceras o versiones;
solo establece lo verificado localmente. No se atribuyó el fallo al SDK ni se
efectuó una actualización mayor como supuesto arreglo.

## Fase 2: secuencia real autorizada

Se utilizó el modelo configurado y solicitado, `gemini-3.5-flash-lite`, con la clave
cargada desde `.env`, sin modificarla ni publicarla. Se usó SDK 1.75.0 para conservar
la línea base. Los límites de timeout y attempts=1 se configuraron en el transporte;
no se añadieron parámetros opcionales de generación a A.

| Prueba | Solicitud | Resultado |
|---|---|---|
| A | Solo modelo y texto sencillo, sin config ni esquema | APROBADO: `OK` |
| B | JSON estructurado con dos propiedades, status y count | APROBADO: JSON válido y validado por Pydantic |
| C | Servicio académico real de TriKUp, texto extraído de PDF sintético y esquema completo | FALLIDO: proveedor HTTP 400 INVALID_ARGUMENT |

Respuesta real B:

```json
{"status":"ok","count":1}
```

Error sanitizado real C:

```json
{
  "http_status": 400,
  "message": "Request contains an invalid argument.",
  "status": "INVALID_ARGUMENT",
  "details": []
}
```

No se recuperaron reason ni fieldViolations. La secuencia se detuvo en C. No se
ejecutaron variantes, cambios de versión con llamadas reales, consultas de modelos
ni generaciones adicionales. C llamó al mismo servicio que utiliza el endpoint de
sílabos; no se simuló su respuesta.

## Causa: qué está confirmado y qué falta

Está confirmado que esta clave/modelo permite generar texto y JSON estructurado
mínimo. Por tanto, el rechazo observado no requiere la presencia de un fallo básico
de conexión ni la ausencia general de soporte de JSON estructurado.

El error aparece al pasar a la solicitud académica completa. **No se identificó la
causa exacta ni una propiedad concreta incompatible.** C incorpora simultáneamente
un esquema más complejo, instrucciones del sistema, contenido académico y un límite
de salida; la secuencia no aisló esos factores entre sí. No sería correcto afirmar
que una keyword específica o exclusivamente el esquema explica el 400.

No hay una corrección adicional de producción respaldada por estas tres pruebas.
No se eliminó validación, no se desactivó JSON estructurado, no se cambió de modelo
ni proveedor y no se alteraron contratos para forzar una respuesta.

Para aislar la causa haría falta otro presupuesto autorizado y comparar solicitudes
que difieran en un solo factor, usando la B exitosa como base. Eso no se ejecutó
porque se agotaron las tres llamadas y se alcanzó el fallo que obliga a detenerse.

## Archivos de esta revisión

- `backend/scripts/probe_genai_sdk.py`: comparación local mediante MockTransport.
- `backend/scripts/diagnose_gemini_progressive.py`: secuencia A → B → C con parada.
- `backend/tests/test_gemini_progressive.py`: regresiones de orden, parada y parámetros.
- `docs/gemini-compatibility.md`: enlace al diagnóstico posterior.
- Este informe.

Resultados sanitizados y capturas sintéticas en `.tmp`:

- `sdk1-probe.json`, `sdk2-probe.json`, `sdk-comparison.json`.
- `gemini-progressive-result.json`.

La descarga aislada SDK2 también permanece en `.tmp`, ignorada por Git. No se
modificaron archivos del frontend, `.env`, requirements.txt ni código de producción
en esta revisión. La suite original de 89 creció a 96 por las pruebas del diagnóstico.

## Reproducción local sin consumir Gemini

Desde `backend/`:

```powershell
.venv/Scripts/python.exe -m pytest -q --tb=short
.venv/Scripts/python.exe scripts/probe_genai_sdk.py --output .tmp/sdk1-probe.json
.venv/Scripts/python.exe scripts/probe_genai_sdk.py --sdk-path .tmp/sdk2 --output .tmp/sdk2-probe.json
.venv/Scripts/python.exe -c "import sys; sys.path.insert(0, '.tmp/sdk2'); import pytest; raise SystemExit(pytest.main(['-q', '--tb=short']))"
```

El script progresivo exige `--live` y puede consumir tokens. No volver a ejecutarlo
bajo la autorización de esta revisión: su presupuesto real ya está agotado.

## Fuentes oficiales

- [Release google-genai 2.0.0: cambios incompatibles de Interactions](https://github.com/googleapis/python-genai/releases/tag/v2.0.0).
- [SDK oficial: GenerateContent y esquemas JSON](https://googleapis.github.io/python-genai/).
- [Guía de migración Gemini 3.5](https://ai.google.dev/gemini-api/docs/whats-new-gemini-3.5).
