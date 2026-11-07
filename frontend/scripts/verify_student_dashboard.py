"""Local browser QA: settings -> real game results -> panel -> isolated demo controls.
Run from repository root after frontend build with the existing backend Python environment.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
from urllib.request import urlopen
from websockets.sync.client import connect
from verify_courses import ARTIFACTS, FRONTEND, Browser, backend_hashes, port, wait_for
from verify_first_mission import arrange_code, click_selector, memory_pair, press


def stat(b, label):
    return b.js("[...document.querySelectorAll('.student-stats-grid article')].find(e=>e.innerText.includes(" + json.dumps(label) + ")).querySelector('strong').textContent")


def main():
    before = backend_hashes(); ARTIFACTS.mkdir(exist_ok=True)
    http_port, debug_port = port(), port(); base = f'http://127.0.0.1:{http_port}'
    chrome = Path('C:/Program Files/Google/Chrome/Application/chrome.exe')
    if not chrome.exists(): chrome = Path('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')
    flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    processes = []
    with (ARTIFACTS / 'student-browser.log').open('w', encoding='utf-8') as log:
        try:
            with tempfile.TemporaryDirectory(prefix='student-browser-', dir=ARTIFACTS, ignore_cleanup_errors=True) as temp:
                processes.append(subprocess.Popen([shutil.which('node'), str(FRONTEND / 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', str(http_port), '--strictPort'], cwd=FRONTEND, stdout=log, stderr=log, creationflags=flags))
                wait_for(lambda: urlopen(base, timeout=1).status == 200)
                processes.append(subprocess.Popen([str(chrome), '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', f'--remote-debugging-port={debug_port}', f'--user-data-dir={Path(temp) / "profile"}', 'about:blank'], stdout=log, stderr=log, creationflags=flags))
                def target():
                    with urlopen(f'http://127.0.0.1:{debug_port}/json/list', timeout=1) as response: return next((item for item in json.load(response) if item['type'] == 'page'), None)
                page = wait_for(target)
                with connect(page['webSocketDebuggerUrl'], proxy=None, max_size=8 * 1024 * 1024) as ws:
                    b = Browser(ws); b.call('Page.enable'); b.call('Runtime.enable'); b.call('Network.enable')
                    b.call('Emulation.setDeviceMetricsOverride', width=1366, height=768, deviceScaleFactor=1, mobile=False)
                    b.call('Emulation.setEmulatedMedia', features=[{'name': 'prefers-reduced-motion', 'value': 'reduce'}])
                    b.call('Page.bringToFront'); b.call('Emulation.setFocusEmulationEnabled', enabled=True)
                    b.call('Page.navigate', url=base + '/#/dashboard')
                    wait_for(lambda: b.js("Boolean(document.querySelector('#name'))"))
                    assert b.js('location.hash') == '#/onboarding'
                    answers = {'name': 'Alex', 'career': 'Ingeniería de Sistemas', 'otherCareer': '', 'cycle': '2', 'otherCycle': '', 'goal': 'pass_courses', 'motivation': 'personal_records', 'difficulty': 'guided', 'games': ['MEMORY_MATCH'], 'time': 'short', 'tone': 'calm'}
                    session = {'answers': answers, 'screen': 'adventure', 'step': 7, 'profile': {'answers': answers}}
                    seed = b.call('Page.addScriptToEvaluateOnNewDocument', source="localStorage.setItem('trikup-onboarding-v1'," + json.dumps(json.dumps(session)) + ')')
                    b.call('Page.navigate', url=base + '/?student-qa=1#/dashboard')
                    wait_for(lambda: b.js("Boolean(document.querySelector('.student-dashboard'))"))
                    b.call('Page.removeScriptToEvaluateOnNewDocument', identifier=seed['identifier'])
                    assert '¡Hola, Alex!' in b.text()
                    assert stat(b, 'XP ACUMULADA') == '0' and stat(b, 'ACTIVIDADES') == '0'
                    assert stat(b, 'ACIERTOS') == '—' and stat(b, 'RACHA ACTUAL') == '0'
                    assert b.js("document.querySelectorAll('.dashboard-course-card').length") == 0
                    b.js('document.fonts.ready.then(()=>true)')
                    b.screenshot('student-empty-desktop.png'); b.screenshot('student-empty-wide.png', 1920, 1080)
                    b.screenshot('student-empty-tablet.png', 820, 1180); b.screenshot('student-empty-mobile.png', 390, 844); b.screenshot('student-empty-small.png', 320, 800)
                    b.call('Emulation.setDeviceMetricsOverride', width=1366, height=768, deviceScaleFactor=1, mobile=False)
                    click_selector(b, '[aria-label^="Notificaciones,"]', keyboard=True)
                    assert 'No se envían al cerrar la web' in b.text()
                    b.click('LEER TODAS'); press(b, 'Escape', keycode=27)
                    wait_for(lambda: not b.js("Boolean(document.querySelector('.notification-center'))"))
                    count = b.js("JSON.parse(localStorage.getItem('trikup-engagement-v1')).notifications.length")
                    b.call('Page.reload'); wait_for(lambda: b.js("Boolean(document.querySelector('.student-dashboard'))"))
                    assert b.js("JSON.parse(localStorage.getItem('trikup-engagement-v1')).notifications.length") == count
                    assert b.js("JSON.parse(localStorage.getItem('trikup-engagement-v1')).notifications.every(n=>n.readAt)")
                    click_selector(b, '[aria-label="Configurar perfil y preferencias"]')
                    wait_for(lambda: b.js("location.hash==='#/settings'"))
                    b.fill('.preference-fields label:first-child input', 'Lucho')
                    click_selector(b, 'input[name=motivation-tone][value=disciplined]')
                    click_selector(b, 'input[name=visual-mode][value=focused]')
                    click_selector(b, '.activity-preference-grid label:nth-child(2) input')
                    click_selector(b, '.activity-preference-grid + .preference-toggle input')
                    assert 'Objetivo pendiente: completar una actividad' in b.js("document.querySelector('.tone-preview').textContent")
                    b.screenshot('student-settings.png'); b.screenshot('student-settings-mobile.png', 390, 844)
                    b.call('Emulation.setDeviceMetricsOverride', width=1366, height=768, deviceScaleFactor=1, mobile=False)
                    b.click('GUARDAR CAMBIOS'); b.click('VOLVER A MI PANEL')
                    assert '¡Hola, Lucho!' in b.text()
                    assert b.js('document.documentElement.dataset.visualMode') == 'focused'
                    assert 'Ordenamiento y construcción' in b.js("document.querySelector('.recommended-modes li:first-child').textContent")
                    click_selector(b, '[aria-label^="Notificaciones,"]')
                    assert 'Objetivo pendiente: completar una actividad' in b.js("document.querySelector('.notification-center').textContent")
                    press(b, 'Escape', keycode=27)
                    b.click('CREAR MI PRIMER CURSO'); b.click('TENGO MI SÍLABO')
                    sample = Path(temp) / 'syllabus.pdf'; sample.write_bytes(b'%PDF-1.4\n% demo\n')
                    b.upload(sample); b.click('ABRIR MAPA DEMO')
                    wait_for(lambda: b.js("Boolean(document.getElementById('pi17-w01-n1'))"))
                    click_selector(b, '[aria-label="Ir a mi panel"]')
                    assert b.js("document.querySelectorAll('.dashboard-course-card').length") == 1
                    assert stat(b, 'RACHA ACTUAL') == '0'
                    b.click('CONTINUAR MISIÓN')
                    wait_for(lambda: b.js("document.activeElement.id==='pi17-w01-n1'"))
                    click_selector(b, '#pi17-w01-n1', keyboard=True); b.click('COMENZAR MISIÓN')
                    # Two real failed attempts trigger a respectful theory recommendation.
                    for wrong in ['method-definition', 'object-definition']:
                        click_selector(b, '[data-card-id=class-term]'); click_selector(b, f'[data-card-id="{wrong}"]'); b.click('REINTENTAR')
                    assert b.js("Boolean(document.querySelector('.performance-support'))")
                    assert 'repasar la teoría' in b.js("document.querySelector('.performance-support').textContent")
                    for concept in ['class', 'object', 'attribute', 'method']: memory_pair(b, concept, last=concept == 'method')
                    click_selector(b, '[aria-label="Ir a mi panel"]')
                    wait_for(lambda: stat(b, 'ACTIVIDADES') == '1')
                    assert stat(b, 'XP ACUMULADA') == '0' and stat(b, 'RACHA ACTUAL') == '1'
                    assert b.js("document.querySelectorAll('.achievement-card.earned').length") == 0
                    b.click('CONTINUAR MISIÓN'); wait_for(lambda: b.js("document.activeElement.id==='pi17-w01-n1'")); click_selector(b, '#pi17-w01-n1')
                    assert b.js("Boolean(document.querySelector('.rain-arena'))"), 'Partial mission must resume'
                    for answer in ['class', 'attribute', 'method']:
                        click_selector(b, f'[data-answer-id={answer}]'); b.click('IR AL CONSTRUCTOR DE CÓDIGO' if answer == 'method' else 'CONTINUAR')
                    arrange_code(b); b.click('VERIFICAR CÓDIGO'); b.click('FINALIZAR SUBNIVEL')
                    b.click('VER MI PROGRESO')
                    wait_for(lambda: stat(b, 'XP ACUMULADA') == '96')
                    assert stat(b, 'ACTIVIDADES') == '3' and stat(b, 'SUBNIVELES') == '1' and stat(b, 'RACHA ACTUAL') == '1'
                    assert b.js("document.querySelectorAll('.achievement-card.earned').length") == 2
                    assert b.js("document.querySelectorAll('.student-history tbody tr').length") == 3
                    assert 'Fecha no registrada' not in b.js("document.querySelector('.dashboard-course-card .course-card-bottom').textContent")
                    b.screenshot('student-progress-desktop.png'); b.screenshot('student-progress-mobile.png', 390, 844)
                    b.call('Emulation.setDeviceMetricsOverride', width=1366, height=768, deviceScaleFactor=1, mobile=False)
                    b.click('CONTINUAR MISIÓN'); wait_for(lambda: b.js("document.activeElement.id==='pi17-w01-n2'"))
                    click_selector(b, '#pi17-w01-n2'); assert 'Componentes y organización' in b.js("document.querySelector('dialog').textContent")
                    press(b, 'Escape', keycode=27); click_selector(b, '[aria-label="Ir a mi panel"]')
                    notices = b.js("JSON.parse(localStorage.getItem('trikup-engagement-v1')).notifications.map(n=>n.id)")
                    b.call('Page.reload'); wait_for(lambda: b.js("Boolean(document.querySelector('.student-dashboard'))"))
                    assert notices == b.js("JSON.parse(localStorage.getItem('trikup-engagement-v1')).notifications.map(n=>n.id)")
                    assert stat(b, 'XP ACUMULADA') == '96'
                    click_selector(b, '[aria-label^="Notificaciones,"]'); b.screenshot('student-notifications.png'); b.click('LEER TODAS'); press(b, 'Escape', keycode=27)
                    b.js("document.querySelector('.student-demo-tools').open=true")
                    before_activities = b.js("localStorage.getItem('trikup-activities-v1')")
                    before_notices = b.js("localStorage.getItem('trikup-engagement-v1')")
                    for _ in range(2): b.click('SIMULAR DÍA SIGUIENTE'); b.click('SIMULAR ACTIVIDAD SOLO AQUÍ')
                    assert '3' in b.js("document.querySelector('.demo-preview-stats').textContent")
                    assert stat(b, 'RACHA ACTUAL') == '1' and stat(b, 'XP ACUMULADA') == '96'
                    assert before_activities == b.js("localStorage.getItem('trikup-activities-v1')")
                    assert before_notices == b.js("localStorage.getItem('trikup-engagement-v1')")
                    b.click('RESTAURAR PERFIL DEMO'); assert '¡Hola, Alex!' in b.text(); assert stat(b, 'XP ACUMULADA') == '96'
                    assert b.js("Boolean(document.querySelector('.profile-demo-note'))")
                    b.click('REINICIAR PROGRESO'); wait_for(lambda: b.js("Boolean(document.querySelector('dialog[open]'))")); b.click('BORRAR PROGRESO LOCAL')
                    wait_for(lambda: stat(b, 'ACTIVIDADES') == '0')
                    assert stat(b, 'XP ACUMULADA') == '0' and stat(b, 'RACHA ACTUAL') == '0'
                    assert b.js("document.querySelectorAll('.dashboard-course-card').length") == 1
                    assert b.js("document.querySelectorAll('.achievement-card.earned').length") == 0
                    assert '¡Hola, Alex!' in b.text()
                    assert not b.api_requests, b.api_requests
                    assert not b.external_requests, b.external_requests
                    assert not b.errors, b.errors
                    print('PASS: protected dashboard; empty state has no invented stats/courses; editable name/tone/visual/modes; same reminder changes tone without duplicates; read state persists; real course access; continue targets current node; repeated-error support; partial game updates activity/streak but no XP; full mission updates dashboard to 96 XP/3 activities/1 sublevel/2 badges; continue then targets node 2; reload does not duplicate notices/XP; isolated day/activity preview changes no real data; demo profile preserves results; confirmed reset preserves profile/courses; responsive at 1920/1366/820/390/320; no external/API calls or JS errors.', flush=True)
                for process in reversed(processes):
                    if process.poll() is None: process.terminate(); process.wait(timeout=10)
                processes.clear()
        finally:
            for process in reversed(processes):
                if process.poll() is None: process.terminate(); process.wait(timeout=10)
    assert backend_hashes() == before, 'Backend changed'
    print('PASS: backend unchanged. Screenshots: frontend/.tmp/student-*.png', flush=True)


if __name__ == '__main__': main()
