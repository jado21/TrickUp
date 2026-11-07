# Verificación HTTP de misiones — preparada, pendiente de autorización

Fecha: 2026-11-07. **Cero llamadas reales a Gemini en esta revisión.** No se afirma
que el motor haya producido una misión real válida. La prueba real queda detenida
hasta recibir autorización explícita del usuario.

## Inspección y comprobaciones locales

Se revisaron los contratos públicos/privados, rutas, generación, evaluación,
almacenamiento temporal, documentación y pruebas existentes.

La generación de misiones reutiliza `GeminiService.generate_json` y su configuración
de `GEMINI_API_KEY`/`GEMINI_MODEL`. Usa `generation_schema(MissionDraft)`, el mismo
adaptador que omite los límites de arrays en el esquema del proveedor sin quitar
validaciones de Pydantic. Se mantiene google-genai 1.75.0, JSON estructurado y
attempts=1. No se modificó la integración de sílabos ni código de producción.

| Verificación | Estado local | Evidencia |
|---|---|---|
| Cinco modalidades | APROBADO con mocks | Generación de cada modalidad y caso SDK oficial + MockTransport |
| Soluciones privadas | APROBADO con mocks | POST generate y GET no contienen campos de solución |
| Feedback correcto/incorrecto | APROBADO con mocks | Evaluadores de las cinco modalidades y validación HTTP |
| XP sin duplicación | APROBADO con mocks | Replay otorga cero XP; cambio posterior devuelve 409 |
| Contratos para Next.js | APROBADO localmente | JSON discriminado por modality y validación Pydantic |
| Suite completa | APROBADO | 156 aprobadas, cero fallidas, dos advertencias de dependencias |
| pip check y compileall | APROBADO | Sin incompatibilidades ni errores de compilación |
| Generación real de misiones | NO VERIFICADO | Pendiente de autorización, aún no ejecutada |
| Calidad semántica de Gemini real | NO VERIFICADO | Requiere revisar la futura salida contra el material |

La suite inicial de 148 también pasó antes de añadir las ocho pruebas del verificador.
Todas las llamadas de generación durante pytest están simuladas.

## Ejemplo académico preparado

Se reutiliza [la solicitud sintética existente](examples/missions-generate-request.json),
añadiendo explícitamente las cinco modalidades, con activity_count=5.

- Curso: Matemática.
- Unidad: Funciones.
- Nivel/tema: Dominio y rango.
- Objetivo: Identificar dominio y rango.
- Dificultad inicial: beginner, declarada en el perfil del ejemplo.

Material fuente:

```text
Una función relaciona cada entrada con una salida.
El dominio es el conjunto de entradas. El rango es el conjunto de salidas.
Para estudiar una función, primero identifica el dominio.
Después calcula las imágenes. Finalmente describe el rango.
```

Este material permite verificar definiciones, completar una frase, emparejar dos
conceptos, seleccionar bloques y ordenar los tres pasos explícitos. No se solicita
inferir teoría desde títulos de sílabo ni consultar fuentes externas.

## Única generación propuesta por HTTP

El script `backend/scripts/verify_missions_http.py` está preparado para:

1. Validar configuración sin imprimir credenciales; iniciar Uvicorn temporal local.
2. Comprobar salud sin generación y efectuar **un único POST /api/missions/generate**.
3. Vigilar el SDK para impedir otra generación y comprobar modelo configurado,
   JSON MIME, mismo adaptador de esquema y attempts=1 antes del envío.
4. Si falla la generación, terminar sin reintentar ni evaluar actividades. Guardar
   error público y detalles seguros del proveedor cuando existan; distinguir
   modalidades ausentes de modalidades presentes en un borrador inválido.
5. Si devuelve HTTP 200, validar MissionResponse con Pydantic, las modalidades
   efectivamente presentes, IDs únicos y ausencia de soluciones en POST y GET.
6. Resolver cada actividad a través de POST /api/missions/answer. El oráculo de QA
   lee soluciones **dentro del proceso de servidor**, no a través de una ruta pública.
   No se añade un endpoint de soluciones ni se proporcionan claves al frontend.
7. En la prueba HTTP, enviar respuestas correctas para elección, memoria y bloques;
   enviar errores válidos de completar y orden. Esto comprueba ambos resultados
   con una sola misión. Los mocks cubren correcto/incorrecto para cada modalidad.
8. Repetir la misma respuesta: esperar replayed=true y xp_awarded=0. Cambiar una
   ya evaluada: esperar 409. Comprobar progreso final y XP total (38 si retorna una
   actividad de cada modalidad a dificultad beginner).
9. Detener Uvicorn y guardar resultados sanitizados en `.tmp`, ignorado por Git.

Se solicitarán las cinco modalidades. El endpoint rechaza una generación incompleta;
el verificador registrará también cuáles aparecieron en el borrador del proveedor
si puede leerlo. No se dará por aprobada una modalidad que no haya sido evaluada.

El informe automático distingue las comprobaciones técnicas de la revisión humana:
una respuesta HTTP 200 valida estructura y procedencia textual, pero la asociación
correcta entre pregunta, objetivo, distractores y explicación deberá inspeccionarse
con la salida real. Esa revisión quedará pendiente hasta tener datos reales.

Comando **solo después de autorización explícita**:

```powershell
cd backend
.venv/Scripts/python.exe scripts/verify_missions_http.py --live
```

Ese comando **no se ejecutó** al preparar esta revisión. No ejecutar otros scripts
de diagnóstico o reintentos bajo una autorización de una sola generación.

## Artefactos de una futura ejecución autorizada

- `.tmp/missions-http-verification.json`: resultado HTTP, modalidades, feedback
  resumido, XP, controles de privacidad y detalle sanitizado del proveedor.
- `.tmp/missions-http-private-draft.json`: borrador privado para revisión QA local.
  Puede contener soluciones; no se publica, no va al contrato ni se copia a frontend.

La solicitud usa material sintético sin datos personales. Los IDs de la sesión
dejarán de funcionar cuando se detenga el servidor temporal.

## Pruebas ejecutadas

Desde backend/:

```powershell
.venv/Scripts/python.exe -m pytest -q --tb=short
.venv/Scripts/python.exe -m pip check
.venv/Scripts/python.exe -m compileall -q app scripts tests
```

Resultado final: **156 aprobadas**, cero fallidas. Advertencias conocidas de
Starlette/httpx y Google GenAI/Python 3.14. Sin cambios de dependencias.

## Archivos de esta revisión y limitaciones

- `backend/scripts/verify_missions_http.py`: verificador preparado; exige --live.
- `backend/tests/test_missions_http_verification.py`: ocho comprobaciones sin red.
- Este informe y enlace desde `docs/missions-engine.md`.

No se modificaron frontend, `.env`, modelos, endpoints, contrato público, proveedor,
SDK, base de datos ni servicio de sílabos. El almacén sigue siendo temporal y por
proceso; no se convierte esta prueba en una validación de producción distribuida.
No se avanzó a otra fase.
