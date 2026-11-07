# Verificación de fase 2 — 2026-11-07

## Pruebas sin consumo de Gemini

Comando desde `backend/`:

```powershell
.venv/Scripts/python.exe -m pytest -q
```

78 pruebas aprobadas. Dos advertencias de deprecación en dependencias (Starlette/
httpx y Google GenAI/Python 3.14). Sin llamadas reales desde pytest.

## Prueba real autorizada

Se ejecutó **un único POST real**, multipart con un PDF sintético generado a partir
de `backend/tests/fixtures/syllabus-example.txt`, contra Uvicorn local. El servicio
usó la configuración de `backend/.env`, sin imprimir ni modificar la clave.

La respuesta fue **HTTP 503**:

```json
{
  "error": {
    "code": "HTTP_ERROR",
    "message": "Revisa las credenciales, permisos y modelo configurado de Gemini.",
    "details": []
  }
}
```

El JSON se guardó en `backend/.tmp/syllabus-live-response.json` (ignorado por Git).
Es una respuesta real de error, no un mapa generado. No se obtuvo una respuesta
exitosa real ni se reintentó la llamada. El error quedó sanitizado, por lo que el
registro no permite distinguir entre los estados 401, 403 y 404 del proveedor.
Después de esta comprobación se diferenciaron los mensajes seguros de esos tres
casos para facilitar diagnósticos futuros, sin realizar nuevas llamadas.

El modelo configurado era `gemini-2.5-flash`. La [documentación oficial del modelo](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash)
indica restricciones de acceso para usuarios nuevos. Es una posible explicación,
no una causa confirmada para este error; debe revisarse la cuenta/proyecto en Google
AI Studio. No se cambió el modelo automáticamente.

## Swagger UI

Se intentó iniciar Chrome y Edge sin ventana para automatizar Swagger. Ambos
terminaron sin abrir su puerto DevTools. Esos intentos no enviaron ningún POST.
Por tanto, la interacción visual con Swagger **no está verificada**; la prueba real
se realizó por HTTP multipart mediante el modo `--http` del script de verificación.

El servidor y los procesos de navegador de verificación quedaron detenidos.
No se inició la siguiente fase. Para otra prueba real hace falta autorización
adicional, porque se agotó el límite de una prueba indicado por el usuario.
