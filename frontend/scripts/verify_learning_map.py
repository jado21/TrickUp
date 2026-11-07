"""Browser QA for the 17-week map. Uses local production output and no API server.

From repository root, after frontend build:
backend/.venv/Scripts/python.exe frontend/scripts/verify_learning_map.py
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
    with (ARTIFACTS / 'map-browser.log').open('w', encoding='utf-8') as log:
        try:
            with tempfile.TemporaryDirectory(prefix='map-browser-', dir=ARTIFACTS, ignore_cleanup_errors=True) as temp:
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
                    b.call('Network.setBlockedURLs', urls=['*fonts.googleapis.com*', '*fonts.gstatic.com*'])
                    b.call('Page.navigate', url=base + '/#/courses/map')
                    wait_for(lambda: b.js("Boolean(document.querySelector('#name'))"))
                    assert b.js('location.hash') == '#/onboarding'
                    answers = {'name': 'Alex', 'career': 'Ingeniería de Sistemas', 'otherCareer': '', 'cycle': '2', 'otherCycle': '', 'goal': 'pass_courses', 'motivation': 'personal_records', 'difficulty': 'guided', 'games': ['MEMORY_MATCH'], 'time': 'short', 'tone': 'calm'}
                    session = {'answers': answers, 'screen': 'adventure', 'step': 7, 'profile': {'answers': answers}}
                    seed = b.call('Page.addScriptToEvaluateOnNewDocument', source="localStorage.setItem('trikup-onboarding-v1'," + json.dumps(json.dumps(session)) + ')')
                    b.call('Page.navigate', url=base + '/?map-qa=1#/courses/map')
                    wait_for(lambda: 'Elige tu aventura.' in b.text())
                    b.call('Page.removeScriptToEvaluateOnNewDocument', identifier=seed['identifier'])
                    b.click('VOLVER A LOS CURSOS')
                    b.click('TENGO MI SÍLABO')
                    sample = Path(temp) / 'cualquier-curso.pdf'
                    sample.write_bytes(b'%PDF-1.4\n% explicit simulation only\n')
                    b.upload(sample)
                    assert 'PROCESO SIMULADO' in b.text() and 'no se está analizando' in b.text()
                    b.click('ABRIR MAPA DEMO')
                    wait_for(lambda: b.js("document.querySelectorAll('.map-node').length===68"))
                    assert b.js('location.hash') == '#/courses/map'
                    b.js('document.fonts.ready.then(()=>true)')
                    assert b.js('document.fonts.check(\'12px "Press Start 2P"\')')
                    assert b.js("document.querySelectorAll('.map-week-section').length") == 17
                    assert b.js("document.querySelectorAll('.exam-week').length") == 3
                    assert b.js("document.querySelectorAll('.map-node[data-state=locked]').length") == 67
                    assert b.js("document.querySelectorAll('.map-node[data-state=current]').length") == 1
                    assert b.js("document.querySelector('.map-xp').textContent.includes('0 XP')")
                    b.screenshot('learning-map-desktop.png', 1366, 768)
                    b.screenshot('learning-map-wide.png', 1920, 1080)
                    b.screenshot('learning-map-tablet.png', 820, 1180)
                    b.js("document.querySelector('.map-overview').open=false")
                    b.screenshot('learning-map-mobile.png', 390, 844)
                    b.screenshot('learning-map-small.png', 320, 800)
                    b.call('Emulation.setDeviceMetricsOverride', width=1366, height=768, deviceScaleFactor=1, mobile=False)
                    b.js("document.querySelector('.map-overview').open=true")
                    b.call('Page.bringToFront')
                    b.call('Emulation.setFocusEmulationEnabled', enabled=True)
                    # Keyboard activation and focus restoration, not just a synthetic click.
                    b.js("document.getElementById('pi17-w01-n1').focus()")
                    assert b.js('document.activeElement.id') == 'pi17-w01-n1'
                    b.call('Input.dispatchKeyEvent', type='keyDown', key='Enter', code='Enter', text='\r', unmodifiedText='\r', windowsVirtualKeyCode=13, nativeVirtualKeyCode=13)
                    b.call('Input.dispatchKeyEvent', type='keyUp', key='Enter', code='Enter', windowsVirtualKeyCode=13)
                    wait_for(lambda: b.js("location.hash==='#/courses/map/poo'"))
                    assert 'COMENZAR MISIÓN' in b.text()
                    b.screenshot('learning-node-first-mission.png')
                    b.click('VOLVER AL MAPA')
                    assert b.js("document.querySelectorAll('.map-node[data-state=completed]').length") == 0
                    assert b.js("[...document.querySelectorAll('button')].find(e=>e.innerText.includes('AVANZAR DEMO')).disabled")
                    b.js("document.getElementById('pi17-w01-n2').click()")
                    assert 'Completa los desafíos anteriores en orden' in b.text()
                    assert b.js("[...document.querySelectorAll('dialog button')].find(b=>b.innerText.includes('COMENZAR DESAFÍO')).disabled")
                    b.js("document.querySelector('[aria-label=\"Cerrar preparación\"]').click()")
                    # Load an explicitly legacy demo completion to exercise the remaining map controls.
                    # The normal first mission is covered end-to-end by verify_first_mission.py.
                    b.js("(()=>{const course=JSON.parse(localStorage.getItem('trikup-courses-v1'))[0]; localStorage.setItem('trikup-map-v1:programming-i-17-weeks:'+encodeURIComponent(course.id),JSON.stringify({mapId:'programming-i-17-weeks',mapVersion:1,completions:[{nodeId:'pi17-w01-n1',source:'demo',xp:0}]}));})()")
                    b.call('Page.reload')
                    wait_for(lambda: b.js("document.querySelectorAll('.map-node[data-state=completed]').length===1"))
                    b.js("document.getElementById('pi17-w01-n2').focus();document.getElementById('pi17-w01-n2').click()")
                    b.click('COMENZAR DESAFÍO')
                    assert 'Este desafío estará disponible próximamente.' in b.text()
                    b.call('Input.dispatchKeyEvent', type='keyDown', key='Escape', code='Escape', windowsVirtualKeyCode=27)
                    b.call('Input.dispatchKeyEvent', type='keyUp', key='Escape', code='Escape', windowsVirtualKeyCode=27)
                    wait_for(lambda: not b.js("Boolean(document.querySelector('dialog[open]'))"))
                    assert b.js('document.activeElement.id') == 'pi17-w01-n2'
                    # Every week is explorable; seeing an exam never unlocks its nodes.
                    b.js("document.querySelector('.map-overview').open=true")
                    b.js("document.querySelector('[aria-label^=\"Ver semana 8:\"]').click()")
                    wait_for(lambda: '¡Se acerca un gran desafío!' in b.text())
                    assert b.js("document.querySelectorAll('#map-week-8 .map-node[data-state=locked]').length") == 4
                    image = b.call('Page.captureScreenshot', format='png')['data']
                    (ARTIFACTS / 'learning-map-exam.png').write_bytes(base64.b64decode(image))
                    for _ in range(3):
                        b.click('AVANZAR DEMO')
                    assert b.js("document.querySelectorAll('.map-node[data-state=completed]').length") == 4
                    assert b.js("document.getElementById('pi17-w02-n1').dataset.state") == 'current'
                    assert b.js("document.querySelectorAll('#map-week-1 .week-completion-count .map-glyph').length") == 1
                    assert b.js("document.querySelector('.map-xp').textContent.includes('0 XP')")
                    b.js("document.getElementById('map-week-1').scrollIntoView({block:'start'})")
                    time.sleep(.15)
                    image = b.call('Page.captureScreenshot', format='png')['data']
                    (ARTIFACTS / 'learning-map-completed-week.png').write_bytes(base64.b64decode(image))
                    # Connections must be isolated from labels in the middle lane.
                    assert b.js("[...document.querySelectorAll('.map-node-row')].every(row=>{const label=row.querySelector('.map-node-label').getBoundingClientRect(),track=row.querySelector('.map-node-track').getBoundingClientRect();return label.right<=track.left+1||label.left>=track.right-1})")
                    b.call('Page.reload')
                    wait_for(lambda: b.js("document.querySelectorAll('.map-node[data-state=completed]').length===4"))
                    assert b.js("document.getElementById('pi17-w02-n1').dataset.state") == 'current'
                    assert b.js("document.querySelector('.map-header-progress b').textContent") == '6%'
                    assert b.js("document.querySelector('.map-xp').textContent.includes('0 XP')")
                    b.click('MIS CURSOS')
                    b.click('RETOMAR')
                    assert b.js("document.querySelectorAll('.map-node[data-state=completed]').length") == 4
                    # A second arbitrary PDF uses the same preset and preserves progress, not a new fake analysis.
                    b.click('MIS CURSOS'); b.click('TENGO MI SÍLABO')
                    second = Path(temp) / 'otro-silabo.pdf'; second.write_bytes(b'%PDF-1.4\n% no analysis\n')
                    b.upload(second)
                    # This time let the simulated processing complete automatically.
                    wait_for(lambda: b.js("document.querySelectorAll('.map-node[data-state=completed]').length===4"))
                    assert len(json.loads(b.js("localStorage.getItem('trikup-courses-v1')"))) == 1
                    assert not b.api_requests, b.api_requests
                    assert not b.errors, b.errors
                    print('PASS: protected map route; empty course guard; any PDF -> explicit simulation -> preset; 17 weeks/68 nodes; three exams; first node opens playable mission; remaining nodes use preparation/Escape/focus restore; locked prerequisites; transition gives no XP or completion; exam exploration never unlocks nodes; legacy demo prefix + 3 demo advances unlock week 2 and award chest; progress survives reload and reopening; no duplicate from another PDF; zero API/Gemini requests; no browser errors; responsive overflow checks at 1920/1366/820/390/320.', flush=True)
                for process in reversed(processes):
                    if process.poll() is None:
                        process.terminate(); process.wait(timeout=10)
                processes.clear()
        finally:
            for process in reversed(processes):
                if process.poll() is None:
                    process.terminate(); process.wait(timeout=10)
    assert backend_hashes() == before, 'Backend modified'
    print('PASS: backend unchanged. Screenshots: frontend/.tmp/learning-*.png', flush=True)


if __name__ == '__main__':
    main()
