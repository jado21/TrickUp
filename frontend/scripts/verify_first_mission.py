"""End-to-end local first mission, including wrong answers, hints, reload and replay.

Run after frontend build from repo root:
backend/.venv/Scripts/python.exe frontend/scripts/verify_first_mission.py
"""
import base64
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


def press(b, key, code=None, keycode=13):
    text = '\r' if key == 'Enter' else key if len(key) == 1 else ''
    b.call('Input.dispatchKeyEvent', type='keyDown', key=key, code=code or key, text=text, unmodifiedText=text, windowsVirtualKeyCode=keycode, nativeVirtualKeyCode=keycode)
    b.call('Input.dispatchKeyEvent', type='keyUp', key=key, code=code or key, windowsVirtualKeyCode=keycode)
    time.sleep(.06)


def click_selector(b, selector, keyboard=False):
    expression = 'document.querySelector(' + json.dumps(selector) + ')'
    assert b.js(f'Boolean({expression})'), selector
    b.js(f'{expression}.focus()')
    if keyboard:
        press(b, 'Enter')
    else:
        b.js(f'{expression}.click()')
        time.sleep(.05)


def game_shot(b, filename, selector='.game-panel', width=1366, height=768):
    b.call('Emulation.setDeviceMetricsOverride', width=width, height=height, deviceScaleFactor=1, mobile=False)
    b.js('document.querySelector(' + json.dumps(selector) + ").scrollIntoView({block:'start'});window.scrollBy(0,-170)")
    time.sleep(.18)
    assert b.js('document.documentElement.scrollWidth<=innerWidth'), f'Overflow at {width}'
    image = b.call('Page.captureScreenshot', format='png')['data']
    (ARTIFACTS / filename).write_bytes(base64.b64decode(image))


def memory_pair(b, concept, last=False):
    click_selector(b, f'[data-card-id="{concept}-term"]', keyboard=True)
    click_selector(b, f'[data-card-id="{concept}-definition"]')
    b.click('IR A LLUVIA DE CONCEPTOS' if last else 'CONTINUAR')


def arrange_code(b):
    expected = ['class-header', 'class-open', 'attribute', 'method-header', 'method-open', 'method-body', 'method-close', 'class-close']
    for target, block in enumerate(expected):
        selector = f'[data-block-id="{block}"]'
        for _ in range(8):
            index = b.js("[...document.querySelectorAll('.code-block-list>li')].findIndex(e=>e.dataset.blockId===" + json.dumps(block) + ')')
            if index == target:
                break
            click_selector(b, selector + ' .code-move-buttons button:first-child', keyboard=True)
        assert index == target, block


def main():
    before = backend_hashes()
    ARTIFACTS.mkdir(exist_ok=True)
    http_port, debug_port = port(), port()
    base = f'http://127.0.0.1:{http_port}'
    chrome = Path('C:/Program Files/Google/Chrome/Application/chrome.exe')
    if not chrome.exists():
        chrome = Path('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')
    flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    processes = []
    with (ARTIFACTS / 'mission-browser.log').open('w', encoding='utf-8') as log:
        try:
            with tempfile.TemporaryDirectory(prefix='mission-browser-', dir=ARTIFACTS, ignore_cleanup_errors=True) as temp:
                processes.append(subprocess.Popen([shutil.which('node'), str(FRONTEND / 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', str(http_port), '--strictPort'], cwd=FRONTEND, stdout=log, stderr=log, creationflags=flags))
                wait_for(lambda: urlopen(base, timeout=1).status == 200)
                processes.append(subprocess.Popen([str(chrome), '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', f'--remote-debugging-port={debug_port}', f'--user-data-dir={Path(temp) / "profile"}', 'about:blank'], stdout=log, stderr=log, creationflags=flags))
                def target():
                    with urlopen(f'http://127.0.0.1:{debug_port}/json/list', timeout=1) as response:
                        return next((item for item in json.load(response) if item['type'] == 'page'), None)
                page = wait_for(target)
                with connect(page['webSocketDebuggerUrl'], proxy=None, max_size=8 * 1024 * 1024) as ws:
                    b = Browser(ws)
                    b.call('Page.enable'); b.call('Runtime.enable'); b.call('Network.enable')
                    b.call('Emulation.setDeviceMetricsOverride', width=1366, height=768, deviceScaleFactor=1, mobile=False)
                    b.call('Emulation.setEmulatedMedia', features=[{'name': 'prefers-reduced-motion', 'value': 'reduce'}])
                    b.call('Page.bringToFront'); b.call('Emulation.setFocusEmulationEnabled', enabled=True)
                    b.call('Page.navigate', url=base + '/#/courses/map/poo')
                    wait_for(lambda: b.js("Boolean(document.querySelector('#name'))"))
                    assert b.js('location.hash') == '#/onboarding'
                    answers = {'name': 'Alex', 'career': 'Ingeniería de Sistemas', 'otherCareer': '', 'cycle': '2', 'otherCycle': '', 'goal': 'pass_courses', 'motivation': 'personal_records', 'difficulty': 'guided', 'games': ['MEMORY_MATCH'], 'time': 'short', 'tone': 'calm'}
                    profile = {'answers': answers, 'screen': 'adventure', 'step': 7, 'profile': {'answers': answers}}
                    seed = b.call('Page.addScriptToEvaluateOnNewDocument', source="localStorage.setItem('trikup-onboarding-v1'," + json.dumps(json.dumps(profile)) + ')')
                    b.call('Page.navigate', url=base + '/?mission-qa=1#/courses')
                    wait_for(lambda: b.js("Boolean(document.querySelector('.method-grid'))"))
                    b.call('Page.removeScriptToEvaluateOnNewDocument', identifier=seed['identifier'])
                    b.click('TENGO MI SÍLABO')
                    sample = Path(temp) / 'syllabus.pdf'; sample.write_bytes(b'%PDF-1.4\n% demo\n')
                    b.upload(sample); b.click('ABRIR MAPA DEMO')
                    wait_for(lambda: b.js("Boolean(document.getElementById('pi17-w01-n1'))"))
                    assert b.js("[...document.querySelectorAll('button')].find(e=>e.innerText.includes('AVANZAR DEMO')).disabled"), 'First node cannot be skipped'
                    click_selector(b, '#pi17-w01-n1', keyboard=True)
                    wait_for(lambda: b.js("location.hash==='#/courses/map/poo'"))
                    assert 'COMENZAR MISIÓN' in b.text()
                    assert b.js("document.querySelectorAll('.mission-game-cards article').length") == 3
                    assert b.js("document.querySelector('.sound-toggle').textContent.includes('APAGADO')")
                    click_selector(b, '.sound-toggle', keyboard=True)
                    assert b.js("document.querySelector('.sound-toggle').textContent.includes('ENCENDIDO')")
                    click_selector(b, '.sound-toggle', keyboard=True)
                    b.js('document.fonts.ready.then(()=>true)')
                    b.screenshot('mission-intro-desktop.png')
                    b.screenshot('mission-intro-mobile.png', 390, 844)
                    b.call('Emulation.setDeviceMetricsOverride', width=1366, height=768, deviceScaleFactor=1, mobile=False)
                    click_selector(b, '.theory-access', keyboard=True)
                    assert b.js("document.querySelectorAll('.theory-concepts article').length") == 4
                    assert 'Lucho' in b.text() and 'maullar()' in b.text()
                    b.screenshot('mission-theory.png')
                    press(b, 'Escape', keycode=27)
                    wait_for(lambda: not b.js("Boolean(document.querySelector('dialog[open]'))"))
                    assert b.js("document.activeElement.classList.contains('theory-access')")
                    b.click('COMENZAR MISIÓN')
                    assert b.js("document.querySelectorAll('.memory-card[data-visible=false]').length") == 8
                    original_order = b.js("[...document.querySelectorAll('.memory-card')].map(e=>e.dataset.cardId)")
                    # One mismatch + one explicit hint, with free theory in between.
                    click_selector(b, '[data-card-id="class-term"]', keyboard=True)
                    click_selector(b, '[data-card-id="object-definition"]')
                    assert b.js("Boolean(document.querySelector('.mission-feedback.incorrect'))")
                    click_selector(b, '.mission-feedback .feedback-help button:first-child')
                    assert 'Programación orientada a objetos' in b.text()
                    press(b, 'Escape', keycode=27)
                    click_selector(b, '.mission-feedback .feedback-help button:last-child')
                    b.click('REINTENTAR')
                    assert original_order == b.js("[...document.querySelectorAll('.memory-card')].map(e=>e.dataset.cardId)")
                    memory_pair(b, 'class'); memory_pair(b, 'object')
                    b.call('Page.reload')
                    wait_for(lambda: b.js("document.querySelectorAll('.memory-card.matched').length===4"))
                    assert original_order == b.js("[...document.querySelectorAll('.memory-card')].map(e=>e.dataset.cardId)")
                    game_shot(b, 'mission-memory.png')
                    game_shot(b, 'mission-memory-mobile.png', width=390, height=844)
                    game_shot(b, 'mission-memory-small.png', width=320, height=800)
                    b.call('Emulation.setDeviceMetricsOverride', width=1366, height=768, deviceScaleFactor=1, mobile=False)
                    b.click('VOLVER AL MAPA')
                    assert b.js("document.querySelectorAll('.map-node[data-state=completed]').length") == 0
                    assert b.js("document.getElementById('pi17-w01-n2').dataset.state") == 'locked'
                    click_selector(b, '#pi17-w01-n1')
                    memory_pair(b, 'attribute'); memory_pair(b, 'method', last=True)
                    assert b.js("Boolean(document.querySelector('.rain-arena'))")
                    assert not b.js("document.querySelector('.rain-access-controls input').checked"), 'Calm profile starts untimed'
                    click_selector(b, '[data-answer-id=object]')
                    assert 'Buen intento. Revisemos juntos el concepto.' in b.text()
                    click_selector(b, '.mission-feedback .feedback-help button:last-child')
                    b.click('REINTENTAR')
                    b.js("document.querySelector('.rain-arena').focus()")
                    press(b, '1', code='Digit1', keycode=49)
                    b.click('CONTINUAR')
                    b.js("document.querySelector('.rain-arena').focus()")
                    press(b, '3', code='Digit3', keycode=51)
                    b.click('CONTINUAR')
                    b.call('Page.reload')
                    wait_for(lambda: b.js("Boolean(document.querySelector('.rain-arena'))"))
                    assert 'Pregunta 3 de 3' in b.text()
                    # Timer is explicitly opt-in; opening theory pauses it without penalties.
                    click_selector(b, '.rain-access-controls input')
                    time.sleep(1.15)
                    assert '19' in b.js("document.querySelector('.rain-countdown').textContent")
                    click_selector(b, '.theory-access')
                    remaining = b.js("document.querySelector('.rain-countdown').textContent")
                    time.sleep(1.1)
                    assert remaining == b.js("document.querySelector('.rain-countdown').textContent")
                    press(b, 'Escape', keycode=27)
                    click_selector(b, '.rain-access-controls input')
                    b.call('Emulation.setEmulatedMedia', features=[{'name': 'prefers-reduced-motion', 'value': 'no-preference'}])
                    b.click('REANUDAR MOVIMIENTO')
                    initial_y = b.js("document.querySelector('.falling-answer').getBoundingClientRect().y")
                    time.sleep(.25)
                    assert b.js("getComputedStyle(document.querySelector('.falling-answer')).animationName") == 'none', 'Calm visual mode reduces movement'
                    assert b.js("document.querySelector('.falling-answer').getBoundingClientRect().y") == initial_y
                    game_shot(b, 'mission-rain.png')
                    game_shot(b, 'mission-rain-mobile.png', width=390, height=844)
                    b.call('Emulation.setEmulatedMedia', features=[{'name': 'prefers-reduced-motion', 'value': 'reduce'}])
                    b.call('Emulation.setDeviceMetricsOverride', width=1366, height=768, deviceScaleFactor=1, mobile=False)
                    click_selector(b, '[data-answer-id=method]')
                    b.click('IR AL CONSTRUCTOR DE CÓDIGO')
                    assert b.js("document.querySelectorAll('.code-block-list>li').length") == 8
                    assert not b.js("Boolean(document.querySelector('.resolved-code'))")
                    b.click('VERIFICAR CÓDIGO')
                    assert b.js("Boolean(document.querySelector('.mission-feedback.incorrect'))")
                    assert not b.js("Boolean(document.querySelector('.resolved-code'))"), 'No full solution before request'
                    click_selector(b, '.mission-feedback .feedback-help button:last-child')
                    b.click('REINTENTAR')
                    b.click('SOLICITAR SOLUCIÓN')
                    assert 'class Gato' in b.js("document.querySelector('.resolved-code').textContent")
                    # Mouse selection + destination, then keyboard move controls.
                    click_selector(b, '.code-block-list>li:last-child .code-select')
                    click_selector(b, '.code-block-list>li:first-child .code-select')
                    order = b.js("[...document.querySelectorAll('.code-block-list>li')].map(e=>e.dataset.blockId)")
                    b.call('Page.reload')
                    wait_for(lambda: b.js("Boolean(document.querySelector('.code-block-list'))"))
                    assert order == b.js("[...document.querySelectorAll('.code-block-list>li')].map(e=>e.dataset.blockId)")
                    arrange_code(b)
                    game_shot(b, 'mission-builder.png')
                    game_shot(b, 'mission-builder-mobile.png', width=390, height=844)
                    b.call('Emulation.setDeviceMetricsOverride', width=1366, height=768, deviceScaleFactor=1, mobile=False)
                    b.click('VERIFICAR CÓDIGO')
                    assert 'Nombre es un campo público' in b.text() and 'void' in b.text()
                    b.click('FINALIZAR SUBNIVEL')
                    wait_for(lambda: '¡SUBNIVEL COMPLETADO!' in b.text())
                    assert '81 XP en esta misión' in b.js("document.querySelector('.mission-celebration h2').textContent")
                    assert b.js("document.querySelectorAll('.mission-results article').length") == 3
                    b.screenshot('mission-completed.png')
                    b.call('Page.reload')
                    wait_for(lambda: b.js("Boolean(document.querySelector('.mission-celebration'))"))
                    b.click('VOLVER AL MAPA')
                    assert b.js("document.getElementById('pi17-w01-n1').dataset.state") == 'completed'
                    assert b.js("document.getElementById('pi17-w01-n2').dataset.state") == 'current'
                    assert '81 XP' in b.js("document.querySelector('.map-xp').textContent")
                    b.screenshot('mission-map-unlocked.png')
                    # Replay flawlessly. New score is 100, recorded reward remains the original 81.
                    click_selector(b, '#pi17-w01-n1')
                    b.click('JUGAR DE NUEVO')
                    b.click('COMENZAR MISIÓN')
                    for concept in ['class', 'object', 'attribute', 'method']:
                        memory_pair(b, concept, last=concept == 'method')
                    for answer in ['class', 'attribute', 'method']:
                        click_selector(b, f'[data-answer-id={answer}]')
                        b.click('IR AL CONSTRUCTOR DE CÓDIGO' if answer == 'method' else 'CONTINUAR')
                    arrange_code(b); b.click('VERIFICAR CÓDIGO'); b.click('FINALIZAR SUBNIVEL')
                    assert '100 XP en esta misión de práctica' in b.js("document.querySelector('.mission-celebration h2').textContent")
                    assert '81 XP' in b.js("document.querySelector('.registered-xp').textContent")
                    b.click('VOLVER AL MAPA')
                    assert '81 XP' in b.js("document.querySelector('.map-xp').textContent")
                    assert b.js("document.querySelectorAll('.map-node[data-state=completed]').length") == 1
                    assert not b.api_requests, b.api_requests
                    assert not b.external_requests, b.external_requests
                    assert not b.errors, b.errors
                    print('PASS: protected route; first node -> mission; free theory and Escape/focus; shuffled memory with mismatch/retry and preserved positions; partial reload in all three games; mouse + keyboard choices; calm untimed default; optional timer pauses for theory; C# ID ordering with accessible moves; incorrect/correct feedback and requested solution; 81 XP deterministic score; second node stays locked until all games finish; map unlock; flawless replay scores 100 but retains 81 XP reward; zero API/external requests or JS exceptions; desktop/mobile/small-screen overflow checks.', flush=True)
                for process in reversed(processes):
                    if process.poll() is None:
                        process.terminate(); process.wait(timeout=10)
                processes.clear()
        finally:
            for process in reversed(processes):
                if process.poll() is None:
                    process.terminate(); process.wait(timeout=10)
    assert backend_hashes() == before, 'Backend modified'
    print('PASS: backend unchanged. Screenshots: frontend/.tmp/mission-*.png', flush=True)


if __name__ == '__main__':
    main()
