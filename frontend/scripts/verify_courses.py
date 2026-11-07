"""Local browser QA using installed Chromium and the existing backend Python environment.

Run from repository root: backend/.venv/Scripts/python.exe frontend/scripts/verify_courses.py
No API server or provider credentials are used. Browser artifacts go to frontend/.tmp.
"""
import base64
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
from urllib.request import urlopen
from urllib.parse import urlparse

from websockets.sync.client import connect

FRONTEND = Path(__file__).resolve().parents[1]
ROOT = FRONTEND.parent
ARTIFACTS = FRONTEND / '.tmp'


def port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def wait_for(callback, timeout=15):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        try:
            value = callback()
            if value:
                return value
        except (OSError, TimeoutError, KeyError):
            pass
        time.sleep(.1)
    raise AssertionError('Timed out waiting for browser state')


class Browser:
    def __init__(self, ws):
        self.ws = ws
        self.sequence = 0
        self.api_requests = []
        self.external_requests = []
        self.errors = []

    def call(self, method, **params):
        self.sequence += 1
        seq = self.sequence
        self.ws.send(json.dumps({'id': seq, 'method': method, 'params': params}))
        while True:
            value = json.loads(self.ws.recv(timeout=15))
            if value.get('method') == 'Network.requestWillBeSent':
                url = value['params']['request']['url']
                parsed = urlparse(url)
                if parsed.scheme in ('http', 'https') and parsed.hostname not in ('127.0.0.1', 'localhost'):
                    self.external_requests.append(url)
                if '/api/' in url or 'generativelanguage' in url:
                    self.api_requests.append(url)
            if value.get('method') == 'Runtime.exceptionThrown':
                self.errors.append(value['params']['exceptionDetails'])
            if value.get('id') == seq:
                if 'error' in value:
                    raise RuntimeError(value['error'])
                return value.get('result', {})

    def js(self, expression):
        result = self.call('Runtime.evaluate', expression=expression, returnByValue=True, awaitPromise=True)
        if 'exceptionDetails' in result:
            raise AssertionError(result['exceptionDetails'])
        return result.get('result', {}).get('value')

    def text(self):
        return self.js('document.body.innerText')

    def click(self, text):
        expression = "[...document.querySelectorAll('button')].find(b=>b.innerText.includes(" + json.dumps(text) + ') && !b.disabled)'
        wait_for(lambda: self.js(f'Boolean({expression})'))
        self.js(f'{expression}.click()')
        time.sleep(.08)

    def fill(self, selector, value):
        self.js('''(()=>{const el=document.querySelector(%s); if(!el) throw Error('Missing input');
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,%s);
          el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true}));})()''' % (json.dumps(selector), json.dumps(value)))
        time.sleep(.06)

    def choose(self, selector, value):
        self.js('''(()=>{const el=document.querySelector(%s); el.value=%s; el.dispatchEvent(new Event('change',{bubbles:true}));})()''' % (json.dumps(selector), json.dumps(value)))
        time.sleep(.06)

    def upload(self, file):
        document = self.call('DOM.getDocument')['root']['nodeId']
        node = self.call('DOM.querySelector', nodeId=document, selector='input[type=file]')['nodeId']
        self.call('DOM.setFileInputFiles', nodeId=node, files=[str(file.resolve())])
        time.sleep(.15)

    def screenshot(self, filename, width=1366, height=768):
        self.call('Emulation.setDeviceMetricsOverride', width=width, height=height, deviceScaleFactor=1, mobile=False)
        self.js('window.scrollTo(0,0)')
        time.sleep(.2)
        assert self.js('document.documentElement.scrollWidth<=window.innerWidth'), f'Horizontal overflow at {width}'
        image = self.call('Page.captureScreenshot', format='png', captureBeyondViewport=False)['data']
        (ARTIFACTS / filename).write_bytes(base64.b64decode(image))


def backend_hashes():
    files = []
    for directory in ('app', 'tests', 'scripts'):
        files.extend(p for p in (ROOT / 'backend' / directory).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
    files.extend(p for p in (ROOT / 'backend').iterdir() if p.is_file() and p.suffix != '.log')
    return {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in files}


def main():
    ARTIFACTS.mkdir(exist_ok=True)
    before = backend_hashes()
    http_port, debug_port = port(), port()
    base = f'http://127.0.0.1:{http_port}'
    browser = Path('C:/Program Files/Google/Chrome/Application/chrome.exe')
    if not browser.exists():
        browser = Path('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')
    flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    processes = []
    log = (ARTIFACTS / 'course-browser.log').open('w', encoding='utf-8')
    try:
        with tempfile.TemporaryDirectory(prefix='course-browser-', dir=ARTIFACTS, ignore_cleanup_errors=True) as temp:
            processes.append(subprocess.Popen([shutil.which('node'), str(FRONTEND / 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', str(http_port), '--strictPort'], cwd=FRONTEND, stdout=log, stderr=log, creationflags=flags))
            wait_for(lambda: urlopen(base, timeout=1).status == 200)
            processes.append(subprocess.Popen([str(browser), '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', f'--remote-debugging-port={debug_port}', f'--user-data-dir={Path(temp) / "profile"}', 'about:blank'], stdout=log, stderr=log, creationflags=flags))
            def target():
                with urlopen(f'http://127.0.0.1:{debug_port}/json/list', timeout=1) as response:
                    return next((t for t in json.load(response) if t['type'] == 'page'), None)
            page = wait_for(target)
            with connect(page['webSocketDebuggerUrl'], proxy=None, max_size=8 * 1024 * 1024) as ws:
                b = Browser(ws)
                b.call('Page.enable'); b.call('Runtime.enable'); b.call('Network.enable')
                b.call('Emulation.setEmulatedMedia', features=[{'name': 'prefers-reduced-motion', 'value': 'reduce'}])
                b.call('Network.setBlockedURLs', urls=['*fonts.googleapis.com*', '*fonts.gstatic.com*'])
                b.call('Emulation.setDeviceMetricsOverride', width=1366, height=768, deviceScaleFactor=1, mobile=False)
                b.call('Page.navigate', url=base + '/#/courses')
                wait_for(lambda: 'name' in (b.js("document.querySelector('#name')?.id") or ''))
                assert 'CONFIGURANDO PERFIL' in b.text(), 'Course route must require a profile'
                b.fill('#name', 'Alex')
                b.click('CONTINUAR')
                b.choose('#career', 'Ingeniería de Sistemas')
                b.click('5')
                b.click('CONTINUAR')
                for choice in ['Aprobar mis cursos', 'Superar mis propios récords', 'Prefiero recibir pistas', 'Juegos de memoria', '10 a 15 minutos diarios', 'Tranquilo']:
                    b.click(choice)
                    b.click('CREAR MI PERFIL' if choice == 'Tranquilo' else 'CONTINUAR')
                b.click('ENTRAR A MI AVENTURA')
                wait_for(lambda: b.js("location.hash === '#/dashboard'"))
                b.click('CREAR MI PRIMER CURSO')
                wait_for(lambda: b.js("location.hash === '#/courses'"))
                wait_for(lambda: b.js("document.querySelector('.project-brand img')?.naturalWidth > 0"))
                b.js('document.fonts.ready.then(()=>true)')
                assert b.js('document.fonts.check(\'12px "Press Start 2P"\')'), 'Pixel font must load locally'
                assert 'Alex' in b.text() and 'Ciclo 5' in b.text()
                assert b.js("document.querySelectorAll('.creation-method').length") == 3
                b.screenshot('courses-desktop.png')
                b.screenshot('courses-wide.png', 1920, 1080)
                b.screenshot('courses-mobile.png', 390, 844)
                b.screenshot('courses-tablet.png', 820, 1180)
                b.call('Emulation.setDeviceMetricsOverride', width=1366, height=768, deviceScaleFactor=1, mobile=False)
                b.call('Emulation.setEmulatedMedia', features=[{'name': 'prefers-reduced-motion', 'value': 'no-preference'}])
                b.click('TENGO MI SÍLABO')
                b.click('MOSTRAR TODO')
                assert 'Con tu sílabo podremos organizar las semanas' in b.text()
                b.call('Emulation.setEmulatedMedia', features=[{'name': 'prefers-reduced-motion', 'value': 'reduce'}])
                sample = Path(temp) / 'mi-silabo.pdf'; sample.write_bytes(b'%PDF-1.4\n% demo only\n')
                invalid = Path(temp) / 'not-pdf.txt'; invalid.write_text('not a pdf')
                oversized = Path(temp) / 'too-big.pdf'; oversized.write_bytes(b'%PDF-' + b'x' * (5 * 1024 * 1024))
                b.upload(invalid)
                assert 'Selecciona un PDF' in b.text()
                b.upload(oversized)
                assert 'El tamaño máximo es 5 MiB' in b.text()
                b.upload(sample)
                assert 'PROCESO SIMULADO' in b.text()
                b.click('CANCELAR Y CAMBIAR ARCHIVO')
                b.upload(sample)
                b.click('ABRIR MAPA DEMO')
                wait_for(lambda: b.js("document.querySelectorAll('.map-node').length === 68"))
                b.click('MIS CURSOS')
                b.click('TENGO UNA IMAGEN')
                b.upload(FRONTEND / 'public/trikup-logo.jpg')
                wait_for(lambda: b.js("document.querySelector('.upload-preview')?.naturalWidth > 0"))
                b.click('Eliminar archivo')
                assert not b.js("Boolean(document.querySelector('.upload-preview'))")
                b.upload(FRONTEND / 'public/trikup-logo.jpg')
                wait_for(lambda: b.js("document.querySelector('.upload-preview')?.naturalWidth > 0"))
                b.screenshot('courses-image.png')
                b.click('REVISAR SELECCIÓN')
                b.click('ELEGIR O NOMBRAR UN CURSO')
                b.fill('#custom-course', 'Mi curso personalizado')
                b.click('ELEGIR AVENTURA')
                assert 'Mi curso personalizado' in b.text()
                b.click('CREAR MI AVENTURA')
                assert 'contenido sigue pendiente' in b.text()
                assert 'No se generaron actividades ni semanas' in b.text()
                b.click('CREAR OTRA AVENTURA')
                b.click('QUIERO ELEGIR UN CURSO')
                assert 'Redes de Computadoras' in b.text() and 'Programación I' not in b.js("[...document.querySelectorAll('.catalog-course h3')].map(e=>e.textContent).join('|')")
                b.choose('.catalog-filters label:nth-child(2) select', '2')
                assert 'Programación I' in b.js("[...document.querySelectorAll('.catalog-course h3')].map(e=>e.textContent).join('|')")
                b.choose('.catalog-filters select', 'Medicina')
                assert 'Esta ruta aún no tiene cursos' in b.text()
                b.click('VER TODO EL CATÁLOGO')
                b.fill('input[type=search]', 'PROGRAMACION')
                assert b.js("document.querySelectorAll('.catalog-course').length") == 2
                b.click('Programación I')
                b.screenshot('courses-catalog.png')
                b.click('ELEGIR AVENTURA')
                assert 'Programación I' in b.text() and '17 semanas demo' in b.text()
                b.screenshot('courses-confirmation.png')
                b.click('CREAR MI AVENTURA')
                assert b.js("document.querySelectorAll('.map-week-section').length") == 17
                assert b.js("document.querySelectorAll('.map-node').length") == 68
                b.screenshot('courses-created.png')
                b.screenshot('courses-created-mobile.png', 390, 844)
                assert len(json.loads(b.js("localStorage.getItem('trikup-courses-v1')"))) == 2
                b.call('Page.reload')
                wait_for(lambda: b.js("document.querySelectorAll('.map-node').length === 68"))
                b.click('MIS CURSOS')
                wait_for(lambda: b.js("document.querySelectorAll('.saved-course').length === 2"))
                b.click('RETOMAR')
                assert b.js("document.querySelectorAll('.map-node').length") == 68
                b.click('MIS CURSOS')
                b.click('QUIERO ELEGIR UN CURSO')
                b.click('VER TODO EL CATÁLOGO') if 'Esta ruta aún no tiene cursos' in b.text() else None
                b.choose('.catalog-filters select', '')
                b.choose('.catalog-filters label:nth-child(2) select', '')
                b.fill('input[type=search]', 'programacion i')
                b.click('Programación I')
                b.click('ELEGIR AVENTURA'); b.click('CREAR MI AVENTURA')
                # Cycle now matches the first creation because both used the catalog's reference cycle.
                assert len(json.loads(b.js("localStorage.getItem('trikup-courses-v1')"))) == 2
                b.click('MIS CURSOS')
                b.js("document.querySelector('.course-topbar .logo-button').click()")
                wait_for(lambda: b.js("location.hash === '#/profile'"))
                b.js('history.back()')
                wait_for(lambda: b.js("location.hash === '#/courses' && Boolean(document.querySelector('.method-grid'))"))
                b.js('1')
                assert not b.api_requests, b.api_requests
                assert not b.errors, b.errors
                print('PASS: onboarding -> courses -> 17-week map; missing-profile guard; personalized guide; PDF validation and explicit simulation/cancel; image preview; career/cycle filters; accent-insensitive search; custom empty course; confirmation; persistence/reload; deduplication; profile/back navigation; responsive checks; zero API/Gemini requests; zero uncaught browser errors.', flush=True)
            for process in reversed(processes):
                if process.poll() is None:
                    process.terminate(); process.wait(timeout=10)
            processes.clear()
        assert backend_hashes() == before, 'Backend files changed'
        print('PASS: backend files unchanged. Screenshots: frontend/.tmp/courses-*.png', flush=True)
    finally:
        for process in reversed(processes):
            if process.poll() is None:
                process.terminate(); process.wait(timeout=10)
        log.close()


if __name__ == '__main__':
    main()
