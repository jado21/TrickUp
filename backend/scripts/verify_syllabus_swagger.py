"""Prueba manual opt-in: una petición real desde Swagger UI con Chromium headless.

Ejecutar desde backend/: .venv/Scripts/python.exe scripts/verify_syllabus_swagger.py
Usa credenciales de .env, puede consumir tokens. No pertenece a pytest.
No reintenta el POST. Requiere Edge o Chrome; websockets viene con google-genai.
--http ejecuta solo la comprobación HTTP, sin navegador ni reintentos.
"""

import json
from contextlib import ExitStack
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen

import httpx
import pymupdf
from websockets.sync.client import connect
from websockets.exceptions import ConnectionClosed

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import load_settings
from app.schemas.common import ErrorResponse
from app.schemas.learning import SyllabusResponse

BACKEND = Path(__file__).resolve().parents[1]
TEMP_ROOT = BACKEND / ".tmp"


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def wait_for(callback, seconds=25):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            result = callback()
            if result:
                return result
        except (OSError, TimeoutError):
            pass
        time.sleep(0.25)
    raise RuntimeError("No se completó una etapa de la verificación en el tiempo permitido.")


def stop_process(process):
    if process.poll() is None:
        process.terminate()
        process.wait(timeout=5)


def report_response(status, body, origin):
    output = TEMP_ROOT / "syllabus-live-response.json"
    output.write_text(json.dumps(body, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{origin}: HTTP {int(status)}; POST ejecutados: 1")
    if status != 200:
        ErrorResponse.model_validate(body)
        print("Validación Pydantic ErrorResponse: correcta")
        print(json.dumps(body, ensure_ascii=False, indent=2))
        return 1
    validated = SyllabusResponse.model_validate(body)
    print("Validación Pydantic SyllabusResponse: correcta")
    print(validated.model_dump_json(indent=2))
    print(f"Respuesta guardada en: {output}")
    return 0


class DevTools:
    def __init__(self, ws):
        self.ws = ws
        self.sequence = 0
        self.requests = []
        self.responses = []
        self.finished = set()

    def call(self, method, **params):
        self.sequence += 1
        seq = self.sequence
        self.ws.send(json.dumps({"id": seq, "method": method, "params": params}))
        while True:
            message = json.loads(self.ws.recv(timeout=10))
            if message.get("method") == "Network.requestWillBeSent":
                event = message["params"]
                if event["request"]["url"].endswith("/api/syllabus/analyze") and event["request"]["method"] == "POST":
                    self.requests.append(event["requestId"])
            elif message.get("method") == "Network.responseReceived":
                event = message["params"]
                if event["response"]["url"].endswith("/api/syllabus/analyze"):
                    self.responses.append(event)
            elif message.get("method") == "Network.loadingFinished":
                self.finished.add(message["params"]["requestId"])
            if message.get("id") == seq:
                if "error" in message:
                    raise RuntimeError("Falló una operación de automatización de Swagger.")
                return message.get("result", {})

    def evaluate(self, expression):
        result = self.call("Runtime.evaluate", expression=expression, returnByValue=True)
        if "exceptionDetails" in result:
            raise RuntimeError("Falló una interacción con Swagger UI.")
        return result.get("result", {}).get("value")


def main():
    settings = load_settings()
    if not settings.gemini_api_key or not settings.gemini_model:
        raise RuntimeError("Configura GEMINI_API_KEY y GEMINI_MODEL antes de la prueba real.")
    browsers = [
        Path("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"),
        Path(os.environ.get("PROGRAMFILES", "C:/Program Files")) / "Google/Chrome/Application/chrome.exe",
    ]
    browsers = [browser for browser in browsers if browser.is_file()]
    if not browsers and "--http" not in sys.argv:
        raise RuntimeError("Esta verificación necesita Edge o Chrome instalado.")
    TEMP_ROOT.mkdir(exist_ok=True)
    port, debug_port = free_port(), free_port()
    base = f"http://127.0.0.1:{port}"
    processes = []
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    try:
        with tempfile.TemporaryDirectory(dir=TEMP_ROOT, prefix="swagger-") as work, ExitStack() as shutdown:
            work_path = Path(work)
            sample = work_path / "syllabus-example.pdf"
            with pymupdf.open() as doc:
                doc.new_page().insert_text((50, 60), (BACKEND / "tests/fixtures/syllabus-example.txt").read_text(encoding="utf-8"), fontsize=11)
                doc.save(sample)
            processes.append(subprocess.Popen([
                sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port), "--log-level", "error",
            ], cwd=BACKEND, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=flags))
            shutdown.callback(stop_process, processes[-1])
            def health():
                with urlopen(base + "/api/health", timeout=1) as response:
                    return response.status == 200
            wait_for(health)
            if "--http" in sys.argv:
                print("Ejecutando el único POST real vía HTTP contra Uvicorn (sin navegador).", flush=True)
                with httpx.Client(timeout=75, trust_env=False) as client, sample.open("rb") as file:
                    response = client.post(base + "/api/syllabus/analyze", files={"file": (sample.name, file, "application/pdf")})
                return report_response(response.status_code, response.json(), "HTTP multipart")
            print("Servidor temporal listo; iniciando navegador sin ventana.", flush=True)
            browser_log = shutdown.enter_context((TEMP_ROOT / "chrome-stderr.log").open("w", encoding="utf-8"))
            def page_target():
                with urlopen(f"http://127.0.0.1:{debug_port}/json/list", timeout=1) as response:
                    return next((item for item in json.load(response) if item["type"] == "page"), None)
            target = None
            for browser in browsers:
                processes.append(subprocess.Popen([
                    str(browser), "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
                    "--disable-background-networking", "--disable-component-update", "--enable-logging=stderr",
                    f"--remote-debugging-port={debug_port}", f"--user-data-dir={work_path / browser.stem}", "about:blank",
                ], stdout=subprocess.DEVNULL, stderr=browser_log, creationflags=flags))
                shutdown.callback(stop_process, processes[-1])
                try:
                    target = wait_for(page_target, seconds=10)
                    break
                except RuntimeError:
                    print(f"{browser.stem}: puerto de automatización no disponible; estado={processes[-1].poll()}", flush=True)
                    stop_process(processes[-1])
            if not target:
                raise RuntimeError("Los navegadores locales no habilitaron DevTools; no se envió ningún POST.")
            print("Navegador conectado; abriendo Swagger UI.", flush=True)
            with connect(target["webSocketDebuggerUrl"], proxy=None, max_size=4 * 1024 * 1024) as ws:
                cdp = DevTools(ws)
                cdp.call("Network.enable")
                cdp.call("Page.navigate", url=base + "/api/docs")
                op = "document.querySelector('[id^=\"operations-syllabus-\"]')"
                wait_for(lambda: cdp.evaluate(f"Boolean({op})"))
                print("Swagger UI cargado; preparando PDF de ejemplo.", flush=True)
                cdp.evaluate(f"{op}.querySelector('.opblock-summary').click()")
                wait_for(lambda: cdp.evaluate(f"Boolean({op}.querySelector('.try-out__btn'))"))
                cdp.evaluate(f"{op}.querySelector('.try-out__btn').click()")
                wait_for(lambda: cdp.evaluate(f"Boolean({op}.querySelector('input[type=file]'))"))
                root = cdp.call("DOM.getDocument")["root"]["nodeId"]
                node = cdp.call("DOM.querySelector", nodeId=root, selector="input[type=file]")["nodeId"]
                cdp.call("DOM.setFileInputFiles", files=[str(sample.resolve())], nodeId=node)
                assert cdp.evaluate(f"{op}.querySelector('input[type=file]').files.length") == 1
                # ÚNICA ejecución de la petición. No repetir en caso de error.
                print("Ejecutando el único POST real desde Swagger UI.", flush=True)
                cdp.evaluate(f"{op}.querySelector('.execute').click()")
                def response_ready():
                    cdp.evaluate("1")  # Despacha también eventos de red pendientes.
                    return cdp.responses and cdp.responses[0]["requestId"] in cdp.finished
                wait_for(response_ready, seconds=75)
                assert len(cdp.requests) == 1, "Se esperaba exactamente un POST."
                event = cdp.responses[0]
                raw = cdp.call("Network.getResponseBody", requestId=event["requestId"])["body"]
                body = json.loads(raw)
                exit_code = report_response(event["response"]["status"], body, "Swagger UI")
                if exit_code:
                    return exit_code
                assert cdp.evaluate(f"{op}.innerText.includes('Server response')")
                try:
                    cdp.call("Browser.close")
                except ConnectionClosed:
                    pass
            for process in reversed(processes):
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    process.terminate()
                    process.wait(timeout=5)
            return 0
    finally:
        for process in reversed(processes):
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=5)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        # Sin tracebacks que puedan incluir datos de configuración.
        print(f"Verificación interrumpida: {type(exc).__name__}. No se reintentó el POST.", file=sys.stderr)
        if isinstance(exc, RuntimeError):
            print(str(exc), file=sys.stderr)
        raise SystemExit(1)
