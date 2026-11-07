# TriKUp — backend MVP

API REST para una plataforma educativa universitaria. Sin base de datos ni autenticación.
`/api/syllabus/analyze` extrae texto de PDFs con PyMuPDF y genera un mapa validado
mediante Gemini. Prompt 3 añade misiones de cinco modalidades, evaluación determinista,
XP y adaptación con estado temporal. Roadmaps y planificador siguen respondiendo **501**.
Consulta [el análisis de sílabos](docs/syllabus-analysis.md) para límites y errores.
El [motor de misiones](docs/missions-engine.md) está probado localmente con mocks;
su generación real con Gemini requiere autorización y aún no fue ejecutada.

## Instalación (PowerShell, desde la raíz)

Requiere Python 3.12 o superior.

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
if (-not (Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
cd backend
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

No necesitas activar el entorno virtual. `backend/.env` es opcional para salud y tests.
Define allí `GEMINI_API_KEY` y `GEMINI_MODEL` para analizar sílabos; no subas secretos.
Las variables del entorno tienen prioridad sobre `.env`. El modelo no se elige
automáticamente: usa un identificador habilitado para tu cuenta de Google AI Studio.

- Salud: <http://127.0.0.1:8000/api/health>
- Swagger: <http://127.0.0.1:8000/api/docs>
- OpenAPI: <http://127.0.0.1:8000/api/openapi.json>
- Frontend permitido por CORS: `http://localhost:3000`.

Para misiones usa un único worker. El estado en memoria expira a los 30 minutos y
se pierde al reiniciar o recargar el servidor. No hay base de datos ni autenticación.
El ID es una capacidad temporal: no lo compartas como si fuera un dato público.

## Pruebas (desde backend/)

```powershell
.venv/Scripts/python.exe -m pytest -q
```

Las pruebas usan TestClient, no requieren claves ni red. Para comprobar el servidor
en otra terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

## Organización

```text
backend/
  .env.example
  requirements.txt
  pytest.ini
  app/
    main.py              # aplicación, CORS y errores
    config.py            # configuración del entorno
    api/routes.py        # rutas bajo /api
    schemas/             # contratos y validación
    services/            # Gemini, extracción PDF y coordinación del análisis
  tests/                 # salud, contratos, CORS y configuración
docs/api-contract.md     # contrato para integración del frontend
frontend/                # sin modificaciones
```

No se crean clientes Gemini al importar o arrancar la aplicación.
`GeminiService(settings).create_client()` exige clave y modelo; el llamador deberá
cerrar el cliente mediante `with` o `close()`. El análisis usa el cliente asíncrono,
lo cierra después de cada petición y no hace reintentos automáticos.

Dependencias con rangos de versión mayor para este MVP; no representan un lockfile.
Los ejemplos del contrato original son ilustrativos para mocks del frontend.
La documentación operativa de fase 2 distingue el análisis implementado de las
otras funcionalidades pendientes. No copies `.env.example` sobre un `.env` ya configurado.
